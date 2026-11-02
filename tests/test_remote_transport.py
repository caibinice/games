import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from remote_client import RemoteClient

class RootTransportTests(unittest.TestCase):
    def client(self):
        client=RemoteClient.__new__(RemoteClient)
        client.config={};client.root_password='';client.client=MagicMock()
        client.upload_bytes=MagicMock();client._run_as_root=MagicMock(return_value=('',0))
        return client

    def test_long_command_is_uploaded_and_only_short_command_enters_pty(self):
        client=self.client();command='echo fixture\n'*4000
        self.assertEqual(client.run(command,root=True,timeout=12),'')
        data,path,mode=client.upload_bytes.call_args.args
        self.assertEqual(data,(command+'\n').encode());self.assertEqual(mode,0o600)
        self.assertLess(len(client._run_as_root.call_args.args[0]),100)
        self.assertEqual(client._run_as_root.call_args.args,(f'bash {path}',12))
        client.client.open_sftp.return_value.__enter__.return_value.remove.assert_called_once_with(path)

    def test_uploaded_script_is_removed_on_transport_failure(self):
        client=self.client();client._run_as_root.side_effect=TimeoutError('fixture')
        with self.assertRaises(TimeoutError):client.run('true\n'*5000,root=True,timeout=1)
        client.client.open_sftp.return_value.__enter__.return_value.remove.assert_called_once()

    def test_short_root_commands_still_use_the_existing_path(self):
        client=self.client();client.run('true',root=True,timeout=5)
        client.upload_bytes.assert_not_called();client._run_as_root.assert_called_once_with('true',5)

if __name__=='__main__':unittest.main()
