"""Verifies the Ed25519 signature of a saved definitionguard-dod property with a public key PEM,
the way any reader would: canonical JSON (sorted keys, no spaces) of every field except sig.
Usage: python3 verify_property.py <property.json> <public-key.pem>

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import base64
import json
import sys
from cryptography.hazmat.primitives.serialization import load_pem_public_key

prop = json.load(open(sys.argv[1]))
key = load_pem_public_key(open(sys.argv[2], 'rb').read())
sig = base64.b64decode(prop.pop('sig'))
canonical = json.dumps(prop, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
try:
    key.verify(sig, canonical)
    print('signature valid, keyId', prop.get('keyId'))
except Exception:
    print('signature INVALID')
tampered = dict(prop, isFullySatisfied=not prop.get('isFullySatisfied'))
try:
    key.verify(sig, json.dumps(tampered, sort_keys=True, separators=(',', ':')).encode('utf-8'))
    print('tampered copy: valid (unexpected)')
except Exception:
    print('tampered copy: invalid, as expected')
