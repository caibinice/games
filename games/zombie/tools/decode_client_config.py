"""Decode selected client tables, using reviewed IL2CPP field/array schemas.

This is a strict, read-only decoder, not an emulator of the game. Unity memory
offsets include padding; serialized fields do not. FP values are signed Q32.32.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct


PRIMITIVES = {'byte': 'B', 'short': 'h', 'ushort': 'H', 'int': 'i',
              'uint': 'I', 'long': 'q', 'ulong': 'Q', 'float': 'f', 'FP': 'q'}


class Reader:
    def __init__(self, raw):
        self.raw, self.position = raw, 0

    def take(self, size):
        if size < 0 or self.position + size > len(self.raw):
            raise ValueError(f'Truncated table at byte {self.position}, need {size}')
        start = self.position
        self.position += size
        return self.raw[start:self.position]

    def primitive(self, kind):
        fmt = '>' + PRIMITIVES[kind]
        value = struct.unpack(fmt, self.take(struct.calcsize(fmt)))[0]
        if kind == 'FP':
            value /= 4294967296
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError('Non-finite numeric value')
        return value

    def value(self, kind, schemas):
        if kind in PRIMITIVES:
            return self.primitive(kind)
        if kind == 'string':
            size = self.primitive('uint')
            if size > 65536:
                raise ValueError(f'Oversized string: {size}')
            return self.take(size).decode('utf8').removesuffix('\0')
        result = {}
        for field in schemas[kind]['fields']:
            name, typ, *count = field
            result[name] = ([self.value(typ, schemas) for _ in range(count[0])]
                            if count else self.value(typ, schemas))
        return result


def decode(raw, name, schemas):
    reader = Reader(raw)
    magic, declared_size, version, count = [reader.primitive('uint') for _ in range(4)]
    if magic != 11759 or version != 1 or count > 1000000:
        raise ValueError(f'Unexpected client table header: {magic}, {version}, {count}')
    schema = schemas[name]
    # Client tables carry one additional 32-bit header word after the count.
    # Its meaning is deliberately not inferred as a checksum. Converted tables'
    # declared size can refer to another representation; check actual consumption.
    extra = reader.primitive('uint') if schema['header_bytes'] == 20 else None
    rows = [reader.value(name, schemas) for _ in range(count)]
    if reader.position != len(raw):
        raise ValueError(f'Trailing bytes: consumed {reader.position} of {len(raw)}')
    return {'schema': name, 'version': version, 'count': count,
            'source_sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'declared_size': declared_size, 'extra_header_word': extra,
            'rows': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--schema', required=True)
    parser.add_argument('--schemas', type=Path, default=Path(__file__).with_name('client-schemas.json'))
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Use a new output file; earlier evidence is preserved')
    result = decode(args.source.read_bytes(), args.schema,
                    json.loads(args.schemas.read_text('utf8'))['schemas'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps({k: v for k, v in result.items() if k != 'rows'}))


if __name__ == '__main__':
    main()
