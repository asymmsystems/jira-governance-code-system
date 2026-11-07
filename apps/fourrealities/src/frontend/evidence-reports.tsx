/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the "Evidence reports" tab of the project page (HLD section 8.1): the list, a new report,
 * the download modal with FileCard and useObjectStore, schedules, early deletion and how to check a report.
 * The server checks every call; this view only hides what the viewer may not do.
 */

import React, { useEffect, useState } from 'react';
import {
  Button,
  CodeBlock,
  DatePicker,
  DynamicTable,
  FileCard,
  Inline,
  Link,
  Lozenge,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
  Tooltip,
  UserPicker,
  useObjectStore
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { ReportDetail, ReportFileName, ReportListRow, ReportResult, ReportSchedule, ReportsView } from '../contract/data/reports';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { ActionRow, Card, CardHeader, FormField, ModalContent, NoteBox, PageHeader, TableCard } from '../brand/layout';
import {
  BOUNDARY_TEXT,
  DELETE_TEXT,
  PEOPLE_FILE_TEXT,
  SCHEDULE_TEXT,
  SIGNING_KEYS_URL,
  TAB_SUBTITLE,
  VERIFY_COMMAND,
  VERIFY_TEXT,
  cadenceText,
  createPayload,
  dateText,
  filtersText,
  newReportNote,
  periodText,
  pickedAccountIds,
  pickedValues,
  retentionText,
  scheduleLine,
  shortHash,
  signingText,
  sizeText,
  stateOf
} from '../ui/report-text';
import { TextChange } from './modals';

type ListResponse = ReportResult<ReportsView> | null;
type Option = { label: string; value: string };

const errorOf = (r: { ok?: boolean; error?: { message?: string } } | null | undefined, fallback: string) => (r && r.ok === false && r.error?.message) || fallback;

const NewReportModal: React.FC<{ view: ReportsView; onClose: () => void; onDone: (notice: string) => void }> = ({ view, onClose, onDone }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options: Option[] = view.fields.map(f => ({ label: f.name, value: f.id }));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await invoke('createEvidenceReport', createPayload({ from, to, fieldIds, people }))) as ReportResult<{ reportId: string }> | null;
      if (r?.ok) onDone('The report is queued. It appears here when it is ready.');
      else setError(errorOf(r, 'FourRealities could not make the report. Try again.'));
    } catch {
      setError('FourRealities could not make the report. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>New evidence report</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <ModalContent>
          <FormField id="fr-report-from" label="From" helper="The first day of the period (UTC).">
            <DatePicker id="fr-report-from" value={from} onChange={(v: string) => setFrom(v || '')} />
          </FormField>
          <FormField id="fr-report-to" label="To" helper="The last day of the period (UTC). At most 366 days.">
            <DatePicker id="fr-report-to" value={to} onChange={(v: string) => setTo(v || '')} />
          </FormField>
          <FormField id="fr-report-fields" label="Fields" helper="At most 10. Empty means all fields.">
            <Select id="fr-report-fields" isMulti options={options} onChange={(v: unknown) => setFieldIds(pickedValues(v).slice(0, 10))} />
          </FormField>
          <FormField id="fr-report-people" label="People" helper="At most 10. Empty means everyone.">
            <UserPicker name="fr-report-people" label="People" isMulti onChange={(v: unknown) => setPeople(pickedAccountIds(v).slice(0, 10))} />
          </FormField>
          <NoteBox>
            <Text as="span" size="small">{newReportNote(new Date(), view.retentionDays)}</Text>
          </NoteBox>
          {error ? <SectionMessage appearance="error"><Text as="span">{error}</Text></SectionMessage> : null}
        </ModalContent>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" isDisabled={busy} onClick={onClose}>Cancel</Button>
        <Button appearance="primary" isDisabled={busy || !from || !to} onClick={submit}>Make report</Button>
      </ModalFooter>
    </Modal>
  );
};

const FILE_ROWS: Array<{ file: ReportFileName | 'people.csv'; label: string; type: string }> = [
  { file: 'report.json', label: 'Report (JSON)', type: 'application/json' },
  { file: 'report.csv', label: 'Report (CSV)', type: 'text/csv' },
  { file: 'manifest.json', label: 'Signed manifest', type: 'application/json' },
  { file: 'people.csv', label: 'People file (not signed)', type: 'text/csv' }
];

const DownloadModal: React.FC<{ row: ReportListRow; onClose: () => void }> = ({ row, onClose }) => {
  const [detail, setDetail] = useState<ReportResult<ReportDetail> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { downloadObjects } = useObjectStore();
  useEffect(() => {
    invoke('getEvidenceReport', { reportId: row.reportId })
      .then(r => setDetail((r as ReportResult<ReportDetail>) || null))
      .catch(() => setDetail(null));
  }, [row.reportId]);
  const keyOf = (file: ReportFileName | 'people.csv') => (file === 'people.csv' ? `people:${row.reportId}:csv` : row.objectKeys?.[file]);
  const body = () => {
    if (!detail) return <Spinner size="small" label="Loading" />;
    if (!detail.ok) return <SectionMessage appearance="error"><Text as="span">{detail.error.message}</Text></SectionMessage>;
    if (!detail.download.allowed) return <SectionMessage appearance="warning" title="You cannot download this report"><Text as="span">{detail.download.message || ''}</Text></SectionMessage>;
    return (
      <Stack space={SPACE.item}>
        {FILE_ROWS.map(f => (
          <FileCard
            key={f.file}
            fileName={detail.fileNames[f.file]}
            fileType={f.type}
            onDownload={async () => {
              const key = keyOf(f.file);
              if (!key) return undefined;
              const results = await downloadObjects({ functionKey: 'generateReportDownloadUrls', keys: [key] });
              const first = results[0];
              if (first?.success && first.blob) return first.blob;
              setNotice('FourRealities could not download this file. Check that you can see every issue of the report, then try again.');
              return undefined;
            }}
          />
        ))}
        <Text as="span" size="small" color={TEXT_ROLE.muted}>{PEOPLE_FILE_TEXT}</Text>
        {notice ? <SectionMessage appearance="error"><Text as="span">{notice}</Text></SectionMessage> : null}
      </Stack>
    );
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{`Download: ${periodText(row.range)}`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <ModalContent>{body()}</ModalContent>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
};

const DeleteModal: React.FC<{ row: ReportListRow; onClose: () => void; onDone: (notice: string) => void }> = ({ row, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await invoke('deleteEvidenceReport', { reportId: row.reportId, reason })) as ReportResult<{ tombstone: unknown }> | null;
      if (r?.ok) onDone('The report was deleted. Its deletion record is shown below the list.');
      else setError(errorOf(r, 'FourRealities could not delete the report.'));
    } catch {
      setError('FourRealities could not delete the report.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{`Delete the report for ${periodText(row.range)}`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <ModalContent>
          <Text as="span">{DELETE_TEXT}</Text>
          <FormField id="fr-report-reason" label="Reason" helper="15 to 500 characters. It is kept with the deletion record.">
            <Textfield id="fr-report-reason" onChange={(e: TextChange) => setReason(e.target?.value || '')} />
          </FormField>
          {error ? <SectionMessage appearance="error"><Text as="span">{error}</Text></SectionMessage> : null}
        </ModalContent>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" isDisabled={busy} onClick={onClose}>Cancel</Button>
        <Button appearance="danger" isDisabled={busy || reason.trim().length < 15} onClick={submit}>Delete report</Button>
      </ModalFooter>
    </Modal>
  );
};

const CADENCES: Option[] = [
  { label: cadenceText('WEEKLY'), value: 'WEEKLY' },
  { label: cadenceText('MONTHLY'), value: 'MONTHLY' }
];

const Schedules: React.FC<{ view: ReportsView; onChanged: (schedules: ReportSchedule[], notice: string) => void }> = ({ view, onChanged }) => {
  const [cadence, setCadence] = useState<string>('MONTHLY');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const call = async (resolver: string, payload: Record<string, unknown>, done: string) => {
    setError(null);
    try {
      const r = (await invoke(resolver, payload)) as ReportResult<{ schedules: ReportSchedule[] }> | null;
      if (r?.ok) onChanged(r.schedules, done);
      else setError(errorOf(r, 'FourRealities could not save the schedule.'));
    } catch {
      setError('FourRealities could not save the schedule.');
    }
  };
  return (
    <Card>
      <CardHeader title="Schedules" subtitle={SCHEDULE_TEXT} />
      <Stack space={SPACE.item}>
        {view.schedules.length === 0 ? <Text as="span" color={TEXT_ROLE.secondary}>No schedules.</Text> : null}
        {view.schedules.map(s => (
          <Inline key={s.scheduleId} space={SPACE.item} alignBlock="center" shouldWrap>
            <Text as="span">{scheduleLine(s, view.fields)}</Text>
            <Button appearance="subtle" spacing="compact" onClick={() => call('deleteReportSchedule', { scheduleId: s.scheduleId }, 'Schedule removed.')}>Remove</Button>
          </Inline>
        ))}
        <FormField id="fr-schedule-cadence" label="Cadence">
          <Select id="fr-schedule-cadence" options={CADENCES} value={CADENCES.find(c => c.value === cadence)} onChange={(o: Option | null) => setCadence(o?.value || 'MONTHLY')} />
        </FormField>
        <FormField id="fr-schedule-fields" label="Fields" helper="At most 10. Empty means all fields.">
          <Select id="fr-schedule-fields" isMulti options={view.fields.map(f => ({ label: f.name, value: f.id }))} onChange={(v: unknown) => setFieldIds(pickedValues(v).slice(0, 10))} />
        </FormField>
        <FormField id="fr-schedule-people" label="People" helper="At most 10. Empty means everyone.">
          <UserPicker name="fr-schedule-people" label="People" isMulti onChange={(v: unknown) => setPeople(pickedAccountIds(v).slice(0, 10))} />
        </FormField>
        {error ? <SectionMessage appearance="error"><Text as="span">{error}</Text></SectionMessage> : null}
        <ActionRow>
          <Button appearance="primary" isDisabled={!view.licenceActive} onClick={() => call('saveReportSchedule', { cadence, fieldIds, actorAccountIds: people }, 'Schedule added.')}>Add schedule</Button>
        </ActionRow>
      </Stack>
    </Card>
  );
};

export const EvidenceReports: React.FC = () => {
  const [response, setResponse] = useState<ListResponse>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<ReportListRow | null>(null);
  const [deleting, setDeleting] = useState<ReportListRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      setResponse(((await invoke('getEvidenceReports', {})) as ListResponse) || null);
    } catch {
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (loading) return <Spinner size="small" label="Loading evidence reports" />;
  if (!response || !response.ok) {
    return (
      <SectionMessage appearance="warning" title="Evidence reports unavailable">
        <Text as="span">{errorOf(response, 'FourRealities could not load the evidence reports. Try again.')}</Text>
      </SectionMessage>
    );
  }
  const view = response;
  const done = (text: string) => {
    setCreating(false);
    setDeleting(null);
    setNotice(text);
    load();
  };
  const head = { cells: ['Period', 'Filters', 'Requested', 'State', 'Size', 'SHA-256', 'Action'].map(text => ({ key: text, content: text })) };
  const rows = view.reports.map(r => {
    const state = stateOf(r);
    return {
      key: r.reportId,
      cells: [
        { key: 'period', content: periodText(r.range) },
        { key: 'filters', content: filtersText(r.filters, view.fields) },
        { key: 'by', content: r.requestedByText },
        { key: 'state', content: <Lozenge appearance={state.appearance}>{state.text}</Lozenge> },
        { key: 'size', content: sizeText(r.bytes) },
        { key: 'sha', content: r.reportSha256 ? <Tooltip content={r.reportSha256}><Text as="span">{shortHash(r.reportSha256)}</Text></Tooltip> : '' },
        {
          key: 'action',
          content: r.state === 'DONE' ? (
            <Inline space={SPACE.sub}>
              <Button spacing="compact" onClick={() => setDownloading(r)}>Download</Button>
              {view.canDelete ? <Button spacing="compact" appearance="subtle" onClick={() => setDeleting(r)}>Delete</Button> : null}
            </Inline>
          ) : r.expiresAt ? dateText(r.expiresAt) : ''
        }
      ]
    };
  });
  return (
    <Stack space={SPACE.group}>
      <PageHeader
        title="Evidence reports"
        subtitle={TAB_SUBTITLE}
        metaText={`${retentionText(view.retentionDays)} ${signingText(view.signingKeyId)}`}
        action={view.canCreate ? <Button appearance="primary" onClick={() => setCreating(true)}>New evidence report</Button> : undefined}
      />
      {!view.licenceActive ? (
        <SectionMessage appearance="warning" title="Licence not active">
          <Text as="span">The FourRealities licence for this site is not active, so no new reports are made. Existing reports can still be viewed and downloaded.</Text>
        </SectionMessage>
      ) : null}
      {view.signingKeyId ? null : <SectionMessage appearance="warning"><Text as="span">{signingText(null)}</Text></SectionMessage>}
      {notice ? <NoteBox><Text as="span" size="small">{notice}</Text></NoteBox> : null}
      <TableCard title="Reports" count={view.reports.length} toolbar={<Text as="span" size="small" color={TEXT_ROLE.secondary}>{BOUNDARY_TEXT}</Text>}>
        <DynamicTable head={head} rows={rows} emptyView={<Text as="span" color={TEXT_ROLE.secondary}>No evidence reports yet.</Text>} />
      </TableCard>
      {view.tombstones.length > 0 ? (
        <Card>
          <CardHeader title="Deleted reports" subtitle="Each record stays when a Jira administrator deletes a report before it expires." />
          <Stack space={SPACE.sub}>
            {view.tombstones.map(t => (
              <Text key={`${t.reportId}${t.deletedAt}`} as="span" size="small">{`${dateText(t.deletedAt)}: report ${t.reportId.slice(0, 8)} deleted. Reason: ${t.reason}`}</Text>
            ))}
          </Stack>
        </Card>
      ) : null}
      {view.canSchedule ? <Schedules view={view} onChanged={(schedules, text) => { setResponse({ ...view, schedules }); setNotice(text); }} /> : null}
      <Card>
        <CardHeader title="How to check a report" />
        <Stack space={SPACE.item}>
          <Text as="span">{VERIFY_TEXT}</Text>
          <CodeBlock language="bash" text={VERIFY_COMMAND} />
          <Link href={SIGNING_KEYS_URL} openNewTab>Signing keys</Link>
        </Stack>
      </Card>
      {creating ? <NewReportModal view={view} onClose={() => setCreating(false)} onDone={done} /> : null}
      {downloading ? <DownloadModal row={downloading} onClose={() => setDownloading(null)} /> : null}
      {deleting ? <DeleteModal row={deleting} onClose={() => setDeleting(null)} onDone={done} /> : null}
    </Stack>
  );
};
