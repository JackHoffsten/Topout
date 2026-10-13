import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).resolve().parents[1] / 'deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

SHA = 'a' * 40
OLD = 'b' * 40

class ControlledExecution:
    def __init__(self, previous=OLD):
        self.previous = previous
        self.remote = [SHA, SHA]
        self.fetched = SHA
        self.failure = None
        self.smoke = True
        self.events = []
        self.saved = None

    def remote_sha(self):
        return self.remote.pop(0)

    def read_state(self):
        return {'active': self.previous} if self.previous else {}

    def fetch_source(self, sha):
        self.events.append('fetch')
        return self.fetched

    def prepare_release(self, sha):
        self.events.append('build')

    def compose(self, sha, *args):
        operation = 'migration' if 'migrate' in args else ('stop' if args[0] == 'stop' else ('postgres' if args[-1] == 'postgres' else 'app'))
        self.events.append((sha, operation))
        if self.failure == operation and sha == SHA:
            raise RuntimeError(operation)

    def smoke_test(self):
        self.events.append('smoke')
        if not self.smoke:
            raise RuntimeError('smoke')

    def save_state(self, state):
        self.saved = state

class DeploymentTests(unittest.TestCase):
    def test_success_records_new_active_and_previous_after_smoke(self):
        execution = ControlledExecution()
        deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.saved, {'active': SHA, 'previous': OLD})
        self.assertEqual(execution.events, ['fetch', 'build', (SHA, 'postgres'), (SHA, 'migration'), (SHA, 'app'), 'smoke'])

    def test_stale_main_is_rejected_before_source_or_services_change(self):
        execution = ControlledExecution()
        execution.remote = [OLD]
        with self.assertRaisesRegex(SystemExit, 'not current'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events, [])
        self.assertIsNone(execution.saved)

    def test_main_advancing_during_fetch_does_not_build_or_start_services(self):
        execution = ControlledExecution()
        execution.fetched = OLD
        with self.assertRaisesRegex(SystemExit, 'during fetch'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events, ['fetch'])
        self.assertIsNone(execution.saved)

    def test_main_advancing_during_build_does_not_start_services(self):
        execution = ControlledExecution()
        execution.remote = [SHA, OLD]
        with self.assertRaisesRegex(SystemExit, 'during build'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events, ['fetch', 'build'])
        self.assertIsNone(execution.saved)

    def test_failed_migration_leaves_previous_application_running(self):
        execution = ControlledExecution()
        execution.failure = 'migration'
        with self.assertRaisesRegex(RuntimeError, 'migration'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events, ['fetch', 'build', (SHA, 'postgres'), (SHA, 'migration')])
        self.assertIsNone(execution.saved)

    def test_failed_application_start_restores_previous_images(self):
        execution = ControlledExecution()
        execution.failure = 'app'
        with self.assertRaisesRegex(RuntimeError, 'app'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events[-2:], [(SHA, 'app'), (OLD, 'app')])
        self.assertIsNone(execution.saved)

    def test_failed_smoke_restores_previous_images_without_saving_state(self):
        execution = ControlledExecution()
        execution.smoke = False
        with self.assertRaisesRegex(RuntimeError, 'smoke'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events[-2:], ['smoke', (OLD, 'app')])
        self.assertIsNone(execution.saved)

    def test_failed_first_release_stops_application_services(self):
        execution = ControlledExecution(previous=None)
        execution.smoke = False
        with self.assertRaisesRegex(RuntimeError, 'smoke'):
            deploy.deploy_release(SHA, execution)
        self.assertEqual(execution.events[-2:], ['smoke', (SHA, 'stop')])
        self.assertIsNone(execution.saved)

    def test_invalid_sha_never_reaches_execution(self):
        for sha in ['main', 'A' * 40, SHA + ';command']:
            execution = ControlledExecution()
            with self.assertRaises(ValueError):
                deploy.deploy_release(sha, execution)
            self.assertEqual(execution.events, [])
            self.assertEqual(execution.remote, [SHA, SHA])

if __name__ == '__main__':
    unittest.main()
