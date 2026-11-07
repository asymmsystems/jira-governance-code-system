/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: throwaway spike page (S-1 download with useObjectStore and FileCard; S-2 to S-4 buttons).
 */

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, CodeBlock, FileCard, Heading, Inline, Stack, Text, useObjectStore } from '@forge/react';
import { invoke } from '@forge/bridge';

const NAME = 'fourrealities-PAY-2026-10-01-2026-11-01-abcd1234.json';

const SpikePage: React.FC = () => {
  const [out, setOut] = useState<string>('');
  const [keys, setKeys] = useState<string[]>([]);
  const { downloadObjects } = useObjectStore();
  const run = async (name: string, payload: Record<string, unknown> = {}) => {
    setOut(`${name}: running...`);
    try {
      const r = await invoke(name, payload);
      setOut(`${name}: ${JSON.stringify(r, null, 2)}`);
    } catch (e) {
      setOut(`${name} failed: ${e instanceof Error ? e.message : 'error'}`);
    }
    const k = (await invoke('spikeKeys', {})) as { keys: string[] };
    setKeys(k.keys);
  };
  useEffect(() => { invoke('spikeKeys', {}).then(k => setKeys((k as { keys: string[] }).keys)); }, []);
  return (
    <Stack space="space.200">
      <Heading as="h2">FR evidence report spikes</Heading>
      <Inline space="space.100" shouldWrap>
        <Button onClick={() => run('spikeWrite', { bytes: 2048 })}>S-1 write 2 KB</Button>
        <Button onClick={() => run('spikeWrite', { bytes: 5_000_000 })}>S-1 write 5 MB</Button>
        <Button onClick={() => run('spikeBulk')}>S-2 bulk changelog</Button>
        <Button onClick={() => run('spikeVisibility')}>S-3 visibility check</Button>
        <Button onClick={() => run('spikeRemoteLinks')}>S-3 remote links</Button>
        <Button onClick={() => run('spikeQueue', { kind: 's3', issues: 10000, changesPer: 25 })}>S-3 synthetic job</Button>
        <Button onClick={() => run('spikeResult', { kind: 's3' })}>S-3 result</Button>
        <Button onClick={() => run('spikeQueue', { kind: 's4' })}>S-4 push</Button>
        <Button onClick={() => run('spikeResult', { kind: 's4' })}>S-4 result</Button>
      </Inline>
      {keys.map(key => (
        <FileCard
          key={key}
          fileName={NAME}
          fileType="application/json"
          onDownload={async () => {
            const res = await downloadObjects({ functionKey: 'generateDownloadUrls', keys: [key] });
            const first = res[0];
            setOut(`download ${key}: success=${String(first?.success)} status=${String(first?.status)} size=${String(first?.blob?.size)} error=${String(first?.error)}`);
            return first?.blob;
          }}
        />
      ))}
      <Text>{keys.length} stored objects</Text>
      <CodeBlock language="json" text={out || '(no result)'} />
    </Stack>
  );
};

ForgeReconciler.render(<React.StrictMode><SpikePage /></React.StrictMode>);
