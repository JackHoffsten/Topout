#!/usr/bin/python3 -I
"""Install root-owned as /usr/local/sbin/topout-deploy; accepts only current main."""

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
ENV = {
    'PATH': '/usr/sbin:/usr/bin:/sbin:/bin',
    'HOME': '/root',
    'LANG': 'C.UTF-8',
    'DOCKER_HOST': 'unix:///var/run/docker.sock',
}


def run(*args, **kwargs):
    return subprocess.run(args, check=True, env=ENV, **kwargs)


def release_directory(sha):
    return ROOT / 'releases' / sha


def compose(sha, *args):
    release = release_directory(sha)
    return subprocess.run(
        [
            'docker',
            'compose',
            '--project-directory',
            str(release),
            '-f',
            str(release / 'compose.prod.yaml'),
            *args,
        ],
        env={**ENV, 'RELEASE_SHA': sha},
        check=True,
    )


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
    for src, dest in [
        ('compose.prod.yaml', 'compose.prod.yaml'),
        ('deploy/postgres-init.sh', 'postgres-init.sh'),
    ]:
        target = release / dest
        target.write_bytes((source / src).read_bytes())
        target.chmod(0o644)
    for dockerfile, image in [('server/Dockerfile', 'backend'), ('apps/app/Dockerfile', 'gateway')]:
        run(
            'docker',
            'build',
            '--pull',
            '-f',
            str(source / dockerfile),
            '-t',
            f'topout-{image}:{sha}',
            str(source),
        )


class ProductionExecution:
    """Root-owned Linux execution boundary; deployment policy stays portable."""

    def remote_sha(self):
        return remote_sha()

    def read_state(self):
        state_file = ROOT / 'release.json'
        return json.loads(state_file.read_text()) if state_file.exists() else {}

    def fetch_source(self, sha):
        source = ROOT / 'source'
        if not source.exists():
            run('git', 'clone', '--no-checkout', REPO, str(source))
        run('git', '-C', str(source), 'fetch', '--force', 'origin', 'main')
        fetched = run(
            'git', '-C', str(source), 'rev-parse', 'FETCH_HEAD', capture_output=True, text=True
        ).stdout.strip()
        if fetched == sha:
            run('git', '-C', str(source), 'checkout', '--detach', '--force', sha)
        return fetched

    def prepare_release(self, sha):
        prepare_release(ROOT / 'source', sha)

    def compose(self, sha, *args):
        compose(sha, *args)

    def smoke_test(self):
        for _ in range(12):
            try:
                with urllib.request.urlopen('http://127.0.0.1:18082/', timeout=10) as response:
                    if response.status == 200 and b'<div id="root">' in response.read():
                        return
            except OSError:
                pass
            time.sleep(5)
        raise RuntimeError('Local gateway smoke test failed')

    def save_state(self, state):
        save_state(state)


def deploy_release(sha, execution):
    """Deploy under the caller's operation lock using a controlled execution adapter."""
    if not re.fullmatch('[0-9a-f]{40}', sha):
        raise ValueError('Release must be a full lowercase Git SHA')
    if execution.remote_sha() != sha:
        raise SystemExit('Refusing a release that is not current origin/main')
    previous = execution.read_state().get('active')
    if execution.fetch_source(sha) != sha:
        raise SystemExit('Main advanced during fetch; let the next build deploy')
    execution.prepare_release(sha)
    if execution.remote_sha() != sha:
        raise SystemExit('Main advanced during build; refusing stale deployment')
    execution.compose(sha, 'up', '-d', '--wait', 'postgres')
    # Migration failure leaves the previous app running. Never roll schemas back automatically.
    execution.compose(sha, '--profile', 'migration', 'run', '--rm', '--no-deps', 'migrate')
    try:
        execution.compose(sha, 'up', '-d', '--wait', '--wait-timeout', '180', 'backend', 'gateway')
        execution.smoke_test()
    except Exception:
        if previous:
            execution.compose(
                previous, 'up', '-d', '--wait', '--wait-timeout', '180', 'backend', 'gateway'
            )
            print(f'Rolled images back to {previous}; database was not restored', file=sys.stderr)
        else:
            execution.compose(sha, 'stop', 'backend', 'gateway')
        raise
    execution.save_state({'active': sha, 'previous': previous})
    print(f'Deployed {sha}')


def main():
    if (
        not hasattr(os, 'geteuid')
        or os.geteuid() != 0
        or len(sys.argv) != 2
        or not re.fullmatch('[0-9a-f]{40}', sys.argv[1])
    ):
        raise SystemExit('Usage (root): topout-deploy <full lowercase Git SHA>')
    import fcntl

    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ROOT / 'operations.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        deploy_release(sys.argv[1], ProductionExecution())


if __name__ == '__main__':
    main()
