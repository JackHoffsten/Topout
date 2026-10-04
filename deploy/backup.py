#!/usr/bin/python3 -I
"""Root-only encrypted backups of the running topout-prod PostgreSQL service."""
import datetime as dt
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import time

BACKUPS = Path('/var/backups/topout')
KEY = Path('/etc/topout/secrets/backup.key')
LOCK = Path('/var/lib/topout/operations.lock')
RETENTION_DAYS = 14
NAME = re.compile(r'topout-\d{8}T\d{6}Z-[0-9a-f]{8}\.dump\.gpg')
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root',
       'LANG': 'C.UTF-8', 'DOCKER_HOST': 'unix:///var/run/docker.sock',
       'DOCKER_CONFIG': '/var/lib/topout/backup-docker-config'}


def private_path(path, directory=False):
    info = path.lstat()
    valid_type = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not valid_type or info.st_uid != 0 or info.st_mode & 0o077:
        raise RuntimeError(f'{path} must be root-owned, private, and not a symlink')
    if path.resolve() != path:
        raise RuntimeError(f'{path} must not have symlinked parents')


def init_key():
    private_path(KEY.parent, directory=True)
    # Never replace a key: existing archives would become unreadable.
    fd = os.open(KEY, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as target:
        target.write(secrets.token_hex(32) + '\n')
        target.flush()
        os.fsync(target.fileno())
    print(f'Created {KEY}; keep a separate secure copy. Never regenerate it over an existing key.')


def postgres_container():
    result = subprocess.run(
        ['docker', 'ps', '--no-trunc', '--filter', 'label=com.docker.compose.project=topout-prod',
         '--filter', 'label=com.docker.compose.service=postgres', '--format', '{{.ID}}'],
        env=ENV, check=True, capture_output=True, text=True)
    ids = result.stdout.split()
    if len(ids) != 1 or not re.fullmatch('[0-9a-f]{64}', ids[0]):
        raise RuntimeError('Expected exactly one running topout-prod PostgreSQL container')
    return ids[0]


def encrypt_dump(command, output, key):
    # Stream directly into encryption: no plaintext database dump touches disk.
    with tempfile.TemporaryDirectory(prefix='topout-gpg-') as home:
        os.chmod(home, 0o700)
        dump = subprocess.Popen(command, stdout=subprocess.PIPE, env=ENV)
        try:
            encrypted = subprocess.run(
                ['gpg', '--no-options', '--homedir', home, '--batch', '--yes',
                 '--pinentry-mode', 'loopback', '--no-symkey-cache', '--passphrase-file', str(key),
                 '--cipher-algo', 'AES256', '--symmetric', '--output', str(output)],
                stdin=dump.stdout, env=ENV)
            dump.stdout.close()
            result = dump.wait()
            if encrypted.returncode != 0 or result != 0:
                raise RuntimeError('Dump or encryption failed; previous backups were not pruned')
        finally:
            if dump.stdout and not dump.stdout.closed:
                dump.stdout.close()
            if dump.poll() is None:
                dump.terminate()
                dump.wait()
            subprocess.run(['gpgconf', '--homedir', home, '--kill', 'gpg-agent'], env=ENV,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


def prune(directory, now):
    root = directory.resolve(strict=True)
    removed = 0
    for path in directory.iterdir():
        # Never delete unrelated files, keys, subdirectories, or symlinks.
        if not NAME.fullmatch(path.name):
            continue
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or path.resolve().parent != root:
            continue
        if info.st_mtime < now - RETENTION_DAYS * 86400:
            path.unlink()
            removed += 1
    return removed


def backup():
    import fcntl  # Linux only; permits the pure helper tests to run on Windows too.
    private_path(KEY)
    if not re.fullmatch('[0-9a-f]{64}\n?', KEY.read_text()):
        raise RuntimeError('Backup key is not a generated 256-bit secret')
    private_path(BACKUPS, directory=True)
    private_path(LOCK.parent, directory=True)
    if shutil.disk_usage(BACKUPS).free < 256 * 1024 * 1024:
        raise RuntimeError('Less than 256 MiB free; backup refused')
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'r+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        container = postgres_container()
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        name = f'topout-{stamp}-{secrets.token_hex(4)}.dump.gpg'
        final = BACKUPS / name
        fd, temporary = tempfile.mkstemp(prefix='.partial-', dir=BACKUPS)
        os.close(fd)
        temporary = Path(temporary)
        try:
            encrypt_dump(['docker', 'exec', '--user', 'postgres', container,
                          'pg_dump', '-U', 'postgres', '-d', 'topout',
                          '--format=custom', '--no-owner', '--no-acl'], temporary, KEY)
            if temporary.stat().st_size == 0:
                raise RuntimeError('Encrypted backup is empty')
            os.chmod(temporary, 0o600)
            with temporary.open('rb') as archive:
                os.fsync(archive.fileno())
            temporary.replace(final)
            directory_fd = os.open(BACKUPS, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
            removed = prune(BACKUPS, time.time())
            print(f'Saved {final.name} ({final.stat().st_size} bytes); removed {removed} expired backups')
        finally:
            temporary.unlink(missing_ok=True)


def main():
    if os.name != 'posix' or os.geteuid() != 0:
        raise SystemExit('Run as root on the homeserver')
    os.umask(0o077)
    if sys.argv[1:] == ['--init-key']:
        init_key()
    elif not sys.argv[1:]:
        backup()
    else:
        raise SystemExit('Usage: topout-backup [--init-key]')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        raise SystemExit(f'Backup failed: {error}') from error
