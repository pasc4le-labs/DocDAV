import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable env so each test can set a different AI_OVERRIDES value.
const envMock = vi.hoisted(() => ({ env: { AI_OVERRIDES: undefined as string | undefined } }));
vi.mock('$env/dynamic/private', () => envMock);

import { getAiOverrides } from './config';

beforeEach(() => {
  envMock.env.AI_OVERRIDES = undefined;
});

describe('getAiOverrides', () => {
  it('returns an empty map when the env var is unset', () => {
    expect(getAiOverrides()).toEqual({});
  });

  it('parses a valid JSON map keyed by provider slug', () => {
    envMock.env.AI_OVERRIDES = '{"gemini":"https://gemini.example.test/custom"}';
    expect(getAiOverrides()).toEqual({ gemini: 'https://gemini.example.test/custom' });
  });

  it('keeps multiple providers', () => {
    envMock.env.AI_OVERRIDES =
      '{"gemini":"https://a.test","claude":"https://b.test","perplexity":"https://c.test"}';
    expect(getAiOverrides()).toEqual({
      gemini: 'https://a.test',
      claude: 'https://b.test',
      perplexity: 'https://c.test',
    });
  });

  it('drops non-string and empty-string values', () => {
    envMock.env.AI_OVERRIDES = '{"gemini":"https://e.test","junk":123,"empty":""}';
    expect(getAiOverrides()).toEqual({ gemini: 'https://e.test' });
  });

  it('returns an empty map for invalid JSON', () => {
    envMock.env.AI_OVERRIDES = 'this is not json';
    expect(getAiOverrides()).toEqual({});
  });
});
