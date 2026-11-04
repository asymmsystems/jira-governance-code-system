/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Unit tests for shared UI library layout primitives in src/brand/layout.tsx.
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { findAll, findButton, textOf } from '../frontend/forge-mocks';

jest.mock('@forge/react', () => require('../frontend/forge-mocks').reactMock());

import {
  ActionRow,
  AppSurface,
  AttributionLine,
  Card,
  CardHeader,
  FormField,
  FourColumnGrid,
  GateCard,
  KeyValueInline,
  LabeledInline,
  ListRow,
  ModalContent,
  NoteBox,
  PageHeader,
  PanelHeader,
  Section,
  StatTile,
  StatusBanner,
  StatusLozenge,
  SubSection,
  SummaryBlock,
  TableCard,
  ThreeColumnGrid,
  TwoColumnGrid
} from '../../src/brand/layout';

describe('brand layout primitives', () => {
  it('renders AppSurface in standard and compact modes', () => {
    const standard = TestRenderer.create(<AppSurface><span>Standard</span></AppSurface>);
    expect(findAll(standard.root, 'Box')).toHaveLength(1);
    expect(textOf(standard.toJSON())).toContain('Standard');

    const compact = TestRenderer.create(<AppSurface compact><span>Compact</span></AppSurface>);
    expect(textOf(compact.toJSON())).toContain('Compact');
  });

  it('renders PageHeader with and without optional scopeBadge, subtitle, metaText, and action', () => {
    const full = TestRenderer.create(
      <PageHeader
        title="Four Realities"
        scopeBadge="DEMO"
        subtitle="Delivery assurance and audit readiness"
        metaText="Read 2026-11-01 08:30 UTC"
        action={<button>Refresh</button>}
      />
    );
    const fullText = textOf(full.toJSON());
    expect(fullText).toContain('Four Realities');
    expect(fullText).toContain('DEMO');
    expect(fullText).toContain('Delivery assurance and audit readiness');
    expect(fullText).toContain('Read 2026-11-01 08:30 UTC');
    expect(fullText).toContain('Refresh');
    expect(findAll(full.root, 'Lozenge')[0].props.maxWidth).toBe('100%');

    const minimal = TestRenderer.create(<PageHeader title="Four Realities" />);
    expect(textOf(minimal.toJSON())).toBe('Four Realities');
    expect(findAll(minimal.root, 'Lozenge')).toHaveLength(0);
  });

  it('renders PanelHeader with title, status lozenge, and optional action', () => {
    const renderer = TestRenderer.create(
      <PanelHeader
        title="Four Realities"
        statusText="Incomplete"
        statusAppearance="removed"
        action={<button>Refresh</button>}
      />
    );
    expect(textOf(renderer.toJSON())).toContain('Four Realities');
    expect(textOf(renderer.toJSON())).toContain('Incomplete');
    expect(findAll(renderer.root, 'Lozenge')[0].props.appearance).toBe('removed');
    expect(findAll(renderer.root, 'Lozenge')[0].props.maxWidth).toBe('100%');
    expect(textOf(renderer.toJSON())).toContain('Refresh');

    const minimal = TestRenderer.create(<PanelHeader title="Four Realities" />);
    expect(textOf(minimal.toJSON())).toBe('Four Realities');
    expect(findAll(minimal.root, 'Lozenge')).toHaveLength(0);
  });

  it('renders StatusBanner with semantic Lozenge (not Badge) across all appearances and step styles', () => {
    const incomplete = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Incomplete"
        statusWord="Incomplete"
        appearance="removed"
        summary="Evidence found for 1 of 4 gates."
        nextStep="Next step: link decision record."
        action={<button>Filter</button>}
      />
    );
    expect(textOf(incomplete.toJSON())).toContain('Audit readiness: Incomplete');
    expect(findAll(incomplete.root, 'Badge')).toHaveLength(0);
    expect(findAll(incomplete.root, 'Lozenge')[0].props.appearance).toBe('removed');
    expect(textOf(incomplete.toJSON())).toContain('Evidence found for 1 of 4 gates.');
    expect(textOf(incomplete.toJSON())).toContain('Next step: link decision record.');
    expect(textOf(incomplete.toJSON())).toContain('Filter');

    const plainIncomplete = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Incomplete"
        statusWord="Incomplete"
        summary="0 of 1 issues are rated."
        nextStep="Rate issues to assess delivery audit readiness."
      />
    );
    expect(textOf(plainIncomplete.toJSON())).toContain('Next step: Rate issues to assess delivery audit readiness.');

    const moved = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Recheck"
        statusWord="Recheck"
        appearance="moved"
        summary="Stale link."
        nextStep="Next step: refresh."
      />
    );
    expect(findAll(moved.root, 'Lozenge')[0].props.appearance).toBe('moved');

    const complete = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Complete"
        statusWord="Complete"
        appearance="success"
        summary="All gates evidenced."
        nextStep="All rated gates are evidenced."
      />
    );
    expect(findAll(complete.root, 'Lozenge')[0].props.appearance).toBe('success');
    expect(textOf(complete.toJSON())).toContain('All rated gates are evidenced.');

    const neutral = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Unrated"
        statusWord="Unrated"
        appearance="default"
        summary="No rated gates."
        nextStep="Start work."
      />
    );
    expect(findAll(neutral.root, 'Lozenge')[0].props.appearance).toBe('default');
  });

  it('renders Grid layouts with matching gutters and SummaryBlock / Card surfaces', () => {
    const four = TestRenderer.create(<FourColumnGrid><span>1</span><span>2</span></FourColumnGrid>);
    const two = TestRenderer.create(<TwoColumnGrid><span>A</span><span>B</span></TwoColumnGrid>);
    const three = TestRenderer.create(<ThreeColumnGrid><span>X</span></ThreeColumnGrid>);
    expect(findAll(four.root, 'Inline')[0].props.space).toBe(findAll(two.root, 'Inline')[0].props.space);
    expect(findAll(four.root, 'Inline')[0].props.rowSpace).toBe(findAll(two.root, 'Inline')[0].props.rowSpace);
    expect(findAll(four.root, 'Box')).toHaveLength(2);
    expect(findAll(two.root, 'Box')).toHaveLength(2);
    expect(findAll(three.root, 'Box')).toHaveLength(1);

    const summary = TestRenderer.create(<SummaryBlock><span>Summary</span></SummaryBlock>);
    expect(textOf(summary.toJSON())).toContain('Summary');
    const card = TestRenderer.create(<Card><span>Card body</span></Card>);
    expect(textOf(card.toJSON())).toContain('Card body');
  });

  it('renders TableCard unifying toolbar and table, StatTile, ListRow, ModalContent, and FormField', () => {
    const tableCard = TestRenderer.create(
      <TableCard
        title="Issue triage"
        count={4}
        metaText="Showing 4 of 4 issues"
        headerAction={<button>Wide text</button>}
        toolbar={<span>Filters</span>}
      >
        <span>Table rows</span>
      </TableCard>
    );
    const tcText = textOf(tableCard.toJSON());
    expect(tcText).toContain('Issue triage');
    expect(tcText).toContain('Showing 4 of 4 issues');
    expect(tcText).toContain('Wide text');
    expect(tcText).toContain('Filters');
    expect(tcText).toContain('Table rows');

    const minimalTableCard = TestRenderer.create(
      <TableCard title="Issues" toolbar={<span>Search</span>}>
        <span>Rows</span>
      </TableCard>
    );
    expect(textOf(minimalTableCard.toJSON())).toContain('Issues');

    const statFull = TestRenderer.create(<StatTile label="Coverage" value={<span>3 rated</span>} caption="1 unrated" />);
    expect(textOf(statFull.toJSON())).toContain('1 unrated');
    const statMin = TestRenderer.create(<StatTile label="Coverage" value={<span>0 rated</span>} />);
    expect(textOf(statMin.toJSON())).toContain('0 rated');

    const rowWithAction = TestRenderer.create(<ListRow divided action={<button>Inspect</button>}><span>DEMO-1</span></ListRow>);
    expect(textOf(rowWithAction.toJSON())).toContain('Inspect');
    const rowPlain = TestRenderer.create(<ListRow divided={false}><span>DEMO-2</span></ListRow>);
    expect(textOf(rowPlain.toJSON())).toContain('DEMO-2');

    const modal = TestRenderer.create(
      <ModalContent>
        <FormField id="f-1" label="Reason" helper="At least 15 characters">
          <span>Input 1</span>
        </FormField>
        <FormField id="f-2" label="Notes">
          <span>Input 2</span>
        </FormField>
      </ModalContent>
    );
    expect(textOf(modal.toJSON())).toContain('At least 15 characters');
    expect(findAll(modal.root, 'Label')[0].props.labelFor).toBe('f-1');
  });

  it('renders Section collapsed by default and toggles on click', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <Section title="Gate findings" count={4} defaultCollapsed={true}>
          <span>Gate detail row</span>
        </Section>
      );
    });

    expect(textOf(renderer.toJSON())).toContain('Gate findings');
    expect(textOf(renderer.toJSON())).toContain('4');
    expect(textOf(renderer.toJSON())).toContain('Show details');
    expect(textOf(renderer.toJSON())).not.toContain('Gate detail row');

    await act(async () => {
      findButton(renderer.root, 'Show details').props.onClick();
    });
    expect(textOf(renderer.toJSON())).toContain('Hide details');
    expect(textOf(renderer.toJSON())).toContain('Gate detail row');

    const defSec = TestRenderer.create(<Section title="Summary"><span>Body</span></Section>);
    expect(textOf(defSec.toJSON())).toContain('Summary');
    expect(textOf(defSec.toJSON())).toContain('Show details');
  });

  it('renders SubSection, borderless NoteBox, ActionRow, StatusLozenge, and GateCard', () => {
    const sub = TestRenderer.create(<SubSection><span>Indented</span></SubSection>);
    expect(textOf(sub.toJSON())).toContain('Indented');

    const note = TestRenderer.create(<NoteBox><span>Note text</span></NoteBox>);
    expect(textOf(note.toJSON())).toContain('Note text');

    const actionRow = TestRenderer.create(<ActionRow><button>Action</button></ActionRow>);
    expect(textOf(actionRow.toJSON())).toContain('Action');

    const lozenge = TestRenderer.create(<StatusLozenge state="FOUND" verification="VERIFIED" isBold={true}>Found</StatusLozenge>);
    expect(textOf(lozenge.toJSON())).toContain('Found');
    expect(findAll(lozenge.root, 'Lozenge')[0].props.appearance).toBe('success');
    expect(findAll(lozenge.root, 'Lozenge')[0].props.maxWidth).toBe('100%');

    for (const g of ['intent', 'process', 'code', 'audit'] as const) {
      const card = TestRenderer.create(<GateCard gate={g}><span>{g}</span></GateCard>);
      expect(textOf(card.toJSON())).toContain(g);
      expect(findAll(card.root, 'Box')[0].props.xcss).toBeTruthy();
    }
  });

  it('B-48: renders KeyValueInline, CardHeader, LabeledInline, AttributionLine, StatTile Box wrapper, and full-width SubSection', () => {
    const kvDefault = TestRenderer.create(<KeyValueInline label="Next step:" value="link decision records for 18 issues." />);
    expect(textOf(kvDefault.toJSON())).toBe('Next step: link decision records for 18 issues.');
    expect(findAll(kvDefault.root, 'Inline')[0].props.alignBlock).toBe('baseline');
    expect(findAll(kvDefault.root, 'Inline')[0].props.shouldWrap).toBe(true);
    expect(findAll(kvDefault.root, 'Text').map((t: any) => t.props.as)).toEqual(['span', 'span']);

    const kvCustom = TestRenderer.create(<KeyValueInline label="1. DEMO-2:" value="Link record" size="small" />);
    expect(findAll(kvCustom.root, 'Text').map((t: any) => t.props.size)).toEqual(['small', 'small']);

    const chFull = TestRenderer.create(
      <CardHeader
        title="Priority actions"
        count={3}
        subtitle="Highest-impact gaps"
        metaText="Updated now"
        action={<button>Filter</button>}
      />
    );
    const chFullText = textOf(chFull.toJSON());
    expect(chFullText).toContain('Priority actions');
    expect(chFullText).toContain('3');
    expect(chFullText).toContain('Highest-impact gaps');
    expect(chFullText).toContain('Updated now');
    expect(chFullText).toContain('Filter');

    const chMinimal = TestRenderer.create(<CardHeader title="Trend: last 8 weeks" />);
    expect(textOf(chMinimal.toJSON())).toBe('Trend: last 8 weeks');
    expect(findAll(chMinimal.root, 'Badge')).toHaveLength(0);

    const labeled = TestRenderer.create(
      <LabeledInline label="Views:">
        <button>My issues</button>
      </LabeledInline>
    );
    expect(textOf(labeled.toJSON())).toContain('Views:');
    expect(textOf(labeled.toJSON())).toContain('My issues');
    expect(findAll(labeled.root, 'Inline')[0].props.shouldWrap).toBe(true);

    const attr = TestRenderer.create(
      <AttributionLine prefix="Requested by" accountId="acc-7" suffix="on 2026-11-01: Configuration change only" />
    );
    expect(textOf(attr.toJSON())).toContain('Requested by');
    expect(textOf(attr.toJSON())).toContain('on 2026-11-01: Configuration change only');
    expect(findAll(attr.root, 'User')[0].props.accountId).toBe('acc-7');

    const stat = TestRenderer.create(<StatTile label="Rated average" value={<h3>Alignment 50%</h3>} />);
    expect(findAll(stat.root, 'Box')).toHaveLength(2);

    const sub = TestRenderer.create(<SubSection><span>Full width note</span></SubSection>);
    expect(findAll(sub.root, 'Stack')[0].props.alignInline).toBeUndefined();
  });
});

