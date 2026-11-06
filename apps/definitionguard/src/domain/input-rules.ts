/**
 * Length and format rules for the ids and cursors that resolvers receive in a payload.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Each rule is checked before the value reaches storage, Jira or a message.
 */

/** A checklist item id: the rule validateTemplate applies when a template is saved. */
export const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A paging cursor (a Forge storage cursor or a Jira nextPageToken). Both are opaque, so the rule
 * is only a length limit and visible ASCII characters (no space, no control character).
 */
export const MAX_CURSOR_CHARS = 2048;
const CURSOR_PATTERN = /^[\x21-\x7e]+$/;

/** A Jira group id (a UUID; a group name for an older group). Jira limits a group name to 255. */
export const MAX_GROUP_ID_CHARS = 255;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export const ITEM_ID_INVALID = 'Item ids are 1 to 64 letters, digits, "-" or "_". Refresh the page and try again.';
export const CURSOR_INVALID = 'DefinitionGuard could not read this page of the history. Load the history again.';

/** The item id from a payload, or throws ITEM_ID_INVALID. */
export function itemIdOf(value: unknown): string {
  if (typeof value !== 'string' || !ITEM_ID_PATTERN.test(value)) {
    throw new Error(ITEM_ID_INVALID);
  }
  return value;
}

/** The cursor from a payload: undefined when absent, else checked, or throws the message. */
export function cursorOf(value: unknown, invalidMessage = CURSOR_INVALID): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > MAX_CURSOR_CHARS || !CURSOR_PATTERN.test(value)) {
    throw new Error(invalidMessage);
  }
  return value;
}

/** True when the value can be a Jira group id: text of 1 to 255 characters, no control character. */
export function isGroupId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_GROUP_ID_CHARS && !CONTROL_CHARS.test(value);
}
