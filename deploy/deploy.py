#!/usr/bin/python3 -I
"""Install root-owned as /usr/local/sbin/topout-deploy; accepts only current main."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

ROOT = Path('/var/lib/topout')
REPO = 'https://github.com/JackHoffsten/Topout.git'
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8', 'DOCKER_HOST': 'unix:///var/run/docker.sock'}


def run(*args, **kwargs):
    return subprocess.run(args, check=True, env=ENV, **kwargs)


def release_directory(sha):
    return ROOT / 'releases' / sha

def compose(sha, *args):
    release = release_directory(sha)
    return subprocess.run(
        ['docker', 'compose', '--project-directory', str(release), '-f', str(release / 'compose.prod.yaml'), *args],
        env={**ENV, 'RELEASE_SHA': sha}, check=True)


def remote_sha():
    result = run('git', 'ls-remote', REPO, 'refs/heads/main', capture_output=True, text=True)
    return result.stdout.split()[0]


def save_state(state):
    temp = ROOT / 'release.json.tmp'
    temp.write_text(json.dumps(state) + '\n')
    temp.replace(ROOT / 'release.json')


def prepare_release(source, sha):
    release = release_directory(sha)
    release.mkdir(mode=0o700, parents=True, exist_ok=True)
    for src, dest in [('compose.prod.yaml', 'compose.prod.yaml'),
                      ('deploy/postgres-init.sh', 'postgres-init.sh')]:
        target = release / dest
        target.write_bytes((source / src).read_bytes())
        target.chmod(0o644)
    for dockerfile, image in [('server/Dockerfile', 'backend'),
                              ('apps/app/Dockerfile', 'gateway')]:
        run('docker', 'build', '--pull', '-f', str(source / dockerfile),
            '-t', f'topout-{image}:{sha}', str(source))


def main():
    if os.geteuid() != 0 or len(sys.argv) != 2 or not re.fullmatch('[0-9a-f]{40}', sys.argv[1]):
        raise SystemExit('Usage (root): topout-deploy <full lowercase Git SHA>')
    sha = sys.argv[1]
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ROOT / 'operations.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if remote_sha() != sha:
            raise SystemExit('Refusing a release that is not current origin/main')
        state_file = ROOT / 'release.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        previous = state.get('active')
        source = ROOT / 'source'
        if not source.exists():
            run('git', 'clone', '--no-checkout', REPO, str(source))
        run('git', '-C', str(source), 'fetch', '--force', 'origin', 'main')
        fetched = run('git', '-C', str(source), 'rev-parse', 'FETCH_HEAD', capture_output=True, text=True).stdout.strip()
        if fetched != sha:
            raise SystemExit('Main advanced during fetch; let the next build deploy')
        run('git', '-C', str(source), 'checkout', '--detach', '--force', sha)
        prepare_release(source, sha)
        if remote_sha() != sha:
            raise SystemExit('Main advanced during build; refusing stale deployment')
        compose(sha, 'up', '-d', '--wait', 'postgres')
        # Migration failure leaves the previous app running. Never roll schemas back automatically.
        compose(sha, '--profile', 'migration', 'run', '--rm', '--no-deps', 'migrate')
        try:
            compose(sha, 'up', '-d', '--wait', '--wait-timeout', '180', 'backend', 'gateway')
            for _ in range(12):
                try:
                    with urllib.request.urlopen('http://127.0.0.1:18082/', timeout=10) as response:
                        if response.status == 200 and b'<div id="root">' in response.read():
                            break
                except OSError:
                    pass
                time.sleep(5)
            else:
                raise RuntimeError('Local gateway smoke test failed')
        except Exception:
            if previous:
                compose(previous, 'up', '-d', '--wait', '--wait-timeout', '180', 'backend', 'gateway')
                print(f'Rolled images back to {previous}; database was not restored', file=sys.stderr)
            else:
                compose(sha, 'stop', 'backend', 'gateway')
            raise
        save_state({'active': sha, 'previous': previous})
        print(f'Deployed {sha}')


if __name__ == '__main__':
    main()
