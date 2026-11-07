/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal Phase 1 spike page (development only, removed after the spikes): S-5/S-8 notify, S-6 image, S-7 storage.
 *
 * @author Fahim Farook
 */

import React, { useState } from 'react';
import ForgeReconciler, { Button, Image, Inline, Stack, Text, Textfield, CodeBlock } from '@forge/react';
import { invoke } from '@forge/bridge';

// A 21 x 21 module grid drawn as SVG (S-6 asks only whether UI Kit renders an SVG data URI)
const grid = (() => {
  let rects = '';
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if ((x * 7 + y * 3 + x * y) % 3 === 0) rects += `<rect x="${x * 8}" y="${y * 8}" width="8" height="8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168"><rect width="168" height="168" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
})();
const SVG_URI = 'data:image/svg+xml;base64,' + btoa(grid);

const Spike: React.FC = () => {
  const [issueId, setIssueId] = useState('10072');
  const [groupId, setGroupId] = useState('');
  const [out, setOut] = useState('');
  const run = async (name: string, payload: any) => {
    const started = new Date().toISOString();
    try {
      const r = await invoke(name, payload);
      setOut(prev => `${started} ${name} ${JSON.stringify(payload)}\n${JSON.stringify(r, null, 1)}\n\n${prev}`);
    } catch (err: any) {
      setOut(prev => `${started} ${name} FAILED ${err?.name ?? 'Error'}\n\n${prev}`);
    }
  };
  return (
    <Stack space="space.200">
      <Text>LedgerSeal Phase 1 spikes (development only).</Text>
      <Inline space="space.100">
        <Textfield name="issue" defaultValue="10072" onChange={(e: any) => setIssueId(e.target.value)} />
        <Textfield name="group" placeholder="group id" onChange={(e: any) => setGroupId(e.target.value)} />
      </Inline>
      <Inline space="space.100" shouldWrap>
        <Button onClick={() => run('spike-notify', { issueId, as: 'app' })}>Notify me (as app)</Button>
        <Button onClick={() => run('spike-notify', { issueId, as: 'user' })}>Notify me (as user)</Button>
        <Button onClick={() => run('spike-notify', { issueId, as: 'app', target: 'group', groupId })}>Notify group (as app)</Button>
        <Button onClick={() => run('spike-secret', {})}>Storage spike</Button>
      </Inline>
      <Text>S-6: SVG data URI image below.</Text>
      <Image src={SVG_URI} alt="S-6 test grid" />
      <CodeBlock language="json" text={out || '(no result yet)'} />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <Spike />
  </React.StrictMode>
);
