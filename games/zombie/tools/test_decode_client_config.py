import struct
import unittest
from decode_client_config import decode


class ClientConfigTest(unittest.TestCase):
    schemas = {'Test': {'header_bytes': 20, 'fields': [['ID', 'uint'], ['Value', 'FP'],
                        ['Name', 'string'], ['Slots', 'byte', 2]]}}

    def sample(self):
        row = struct.pack('>IqI', 12, -3 * 4294967296 // 2, 4) + b'abc\0\x02\x03'
        return struct.pack('>5I', 11759, 20 + len(row), 1, 1, 99) + row

    def test_network_endian_q32_string_and_fixed_array(self):
        result = decode(self.sample(), 'Test', self.schemas)
        self.assertEqual(result['rows'], [{'ID': 12, 'Value': -1.5, 'Name': 'abc', 'Slots': [2, 3]}])
        self.assertEqual(result['extra_header_word'], 99)

    def test_truncated_trailing_and_header_rejected(self):
        for raw in [self.sample()[:-1], self.sample() + b'X', b'\0' * 20]:
            with self.assertRaises(ValueError):
                decode(raw, 'Test', self.schemas)

    def test_string_budget_is_bounded(self):
        row = struct.pack('>IqI', 12, 0, 10000000)
        with self.assertRaisesRegex(ValueError, 'Oversized'):
            decode(struct.pack('>5I', 11759, 36, 1, 1, 0) + row, 'Test', self.schemas)


if __name__ == '__main__':
    unittest.main()
