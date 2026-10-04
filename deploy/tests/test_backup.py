"""Run with python3 deploy/tests/test_backup.py; encryption tests need GnuPG."""
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import shlex
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).resolve().parents[1] / 'backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0 and shutil.which('pg_ctl') and shutil.which('gpg'), 'Linux PostgreSQL and GnuPG required')
    def test_real_postgres_dump_encrypt_decrypt_and_isolated_restore(self):
        import pwd
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            account = pwd.getpwnam('postgres')
            os.chown(root, account.pw_uid, account.pw_gid)
            def postgres(*args):
                subprocess.run(['su', 'postgres', '-s', '/bin/sh', '-c', shlex.join(list(args))], check=True, stdout=subprocess.DEVNULL)
            data = root / 'data'
            postgres('initdb', '-D', str(data), '-A', 'trust')
            postgres('pg_ctl', '-D', str(data), '-l', str(root / 'server.log'), '-o', f'-k {root} -c listen_addresses=', '-w', 'start')
            try:
                connection = ['-h', str(root), '-U', 'postgres']
                subprocess.run(['createdb', *connection, 'topout'], check=True)
                subprocess.run(['psql', *connection, '-d', 'topout', '-v', 'ON_ERROR_STOP=1', '-c',
                    "CREATE TABLE training (id integer PRIMARY KEY, note text); INSERT INTO training VALUES (1, 'restore-check');"], check=True, stdout=subprocess.DEVNULL)
                key = root / 'key'
                key.write_text('a' * 64 + '\n')
                key.chmod(0o600)
                archive = root / 'backup.dump.gpg'
                backup.encrypt_dump([shutil.which('pg_dump'), *connection, '-d', 'topout', '--format=custom', '--no-owner', '--no-acl'], archive, key)
                subprocess.run(['createdb', *connection, 'restored'], check=True)
                home = root / 'gpg'
                home.mkdir(mode=0o700)
                decrypt = subprocess.Popen(['gpg', '--no-options', '--homedir', str(home), '--batch', '--pinentry-mode', 'loopback', '--no-symkey-cache', '--passphrase-file', str(key), '--decrypt', str(archive)], stdout=subprocess.PIPE)
                try:
                    restored = subprocess.run(['pg_restore', *connection, '-d', 'restored', '--no-owner', '--no-acl', '--exit-on-error'], stdin=decrypt.stdout)
                    decrypt.stdout.close()
                    self.assertEqual(decrypt.wait(), 0)
                    self.assertEqual(restored.returncode, 0)
                    result = subprocess.run(['psql', *connection, '-d', 'restored', '-At', '-c', 'SELECT note FROM training WHERE id = 1'], check=True, capture_output=True, text=True)
                    self.assertEqual(result.stdout.strip(), 'restore-check')
                finally:
                    if not decrypt.stdout.closed: decrypt.stdout.close()
                    if decrypt.poll() is None: decrypt.terminate(); decrypt.wait()
                    subprocess.run(['gpgconf', '--homedir', str(home), '--kill', 'gpg-agent'], check=False)
            finally:
                postgres('pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')

    def test_container_selection_is_production_only_and_unambiguous(self):
        result = subprocess.CompletedProcess([], 0, 'a' * 64 + '\n')
        with patch.object(backup.subprocess, 'run', return_value=result) as run:
            self.assertEqual(backup.postgres_container(), 'a' * 64)
            command = run.call_args.args[0]
            self.assertIn('label=com.docker.compose.project=topout-prod', command)
            self.assertIn('label=com.docker.compose.service=postgres', command)
        for output in ['', 'abc', 'a' * 64 + '\n' + 'b' * 64]:
            with patch.object(backup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, output)):
                with self.assertRaises(RuntimeError):
                    backup.postgres_container()

    def test_retention_removes_only_matching_expired_regular_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = root / 'topout-20260901T033000Z-1234abcd.dump.gpg'
            fresh = root / 'topout-20261004T033000Z-1234abcd.dump.gpg'
            unrelated = root / 'important.txt'
            old.write_bytes(b'old')
            fresh.write_bytes(b'new')
            unrelated.write_bytes(b'keep')
            now = time.time()
            os.utime(old, (now - 15 * 86400, now - 15 * 86400))
            os.utime(unrelated, (0, 0))
            nested = root / 'topout-20260901T033000Z-eeeeeeee.dump.gpg'
            nested.mkdir()
            self.assertEqual(backup.prune(root, now), 1)
            self.assertFalse(old.exists())
            self.assertTrue(fresh.exists())
            self.assertTrue(unrelated.exists())
            self.assertTrue(nested.is_dir())

    @unittest.skipUnless(os.name == 'posix', 'POSIX symlink/permission checks')
    def test_retention_does_not_follow_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / 'outside'
            target.write_bytes(b'keep')
            os.utime(target, (0, 0))
            link = root / 'topout-20260901T033000Z-1234abcd.dump.gpg'
            link.symlink_to(target)
            self.assertEqual(backup.prune(root, time.time()), 0)
            self.assertTrue(target.exists())
            self.assertTrue(link.is_symlink())

    @unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'root POSIX permission checks')
    def test_private_paths_reject_public_permissions_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'key'
            key.write_text('secret')
            key.chmod(0o600)
            backup.private_path(key)
            key.chmod(0o644)
            with self.assertRaises(RuntimeError):
                backup.private_path(key)
            key.chmod(0o600)
            link = root / 'link'
            link.symlink_to(key)
            with self.assertRaises(RuntimeError):
                backup.private_path(link)

    @unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'root POSIX key generation')
    def test_key_generation_never_overwrites_existing_key(self):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / 'backup.key'
            with patch.object(backup, 'KEY', key):
                backup.init_key()
                first = key.read_bytes()
                self.assertEqual(len(first), 65)
                with self.assertRaises(FileExistsError):
                    backup.init_key()
                self.assertEqual(key.read_bytes(), first)

    @unittest.skipUnless(shutil.which('gpg') and shutil.which('gpgconf'), 'GnuPG required')
    def test_real_encryption_roundtrip_and_wrong_key_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'key'
            wrong = root / 'wrong'
            key.write_text('a' * 64 + '\n')
            wrong.write_text('b' * 64 + '\n')
            archive = root / 'archive.gpg'
            payload = b'PGDMP-private-training-data' * 1000
            source = [sys.executable, '-c', f'import sys; sys.stdout.buffer.write({payload!r})']
            with patch.object(backup, 'ENV', dict(os.environ)):
                backup.encrypt_dump(source, archive, key)
            self.assertNotIn(b'private-training-data', archive.read_bytes())
            home = root / 'gpg'
            home.mkdir(mode=0o700)
            def decrypt(secret):
                return subprocess.run(['gpg', '--no-options', '--homedir', str(home), '--batch',
                    '--pinentry-mode', 'loopback', '--no-symkey-cache', '--passphrase-file', str(secret),
                    '--decrypt', str(archive)], capture_output=True)
            try:
                restored = decrypt(key)
                self.assertEqual(restored.returncode, 0, restored.stderr)
                self.assertEqual(restored.stdout, payload)
                self.assertNotEqual(decrypt(wrong).returncode, 0)
            finally:
                subprocess.run(['gpgconf', '--homedir', str(home), '--kill', 'gpg-agent'], check=False)

    @unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'root POSIX backup orchestration')
    def test_failed_backup_preserves_old_archives_and_cleans_partial_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'key'
            key.write_text('a' * 64 + '\n')
            key.chmod(0o600)
            old = root / 'topout-20260901T033000Z-1234abcd.dump.gpg'
            old.write_bytes(b'keep')
            os.utime(old, (0, 0))
            with patch.object(backup, 'KEY', key), patch.object(backup, 'BACKUPS', root), \
                 patch.object(backup, 'LOCK', root / 'lock'), \
                 patch.object(backup, 'postgres_container', return_value='a' * 64), \
                 patch.object(backup, 'encrypt_dump', side_effect=RuntimeError('dump failed')):
                with self.assertRaises(RuntimeError):
                    backup.backup()
            self.assertTrue(old.exists())
            self.assertFalse(list(root.glob('.partial-*')))


if __name__ == '__main__':
    unittest.main()
