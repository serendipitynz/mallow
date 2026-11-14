import { describe, expect, it } from 'vitest';
import { pathCommandStep } from './path-command';

const path = '/usr/local/bin/mallow';

describe('pathCommandStep', () => {
  it('asks before an install replaces a file mallow did not write', () => {
    expect(pathCommandStep('install', { kind: 'foreign', path })).toEqual({
      ask: { key: 'pathCommandReplace', params: { path } },
    });
  });

  it('leaves such a file in place on uninstall and says so as a failure', () => {
    expect(pathCommandStep('uninstall', { kind: 'foreign', path })).toEqual({
      tell: { key: 'pathCommandForeignKept', params: { path }, failure: true },
    });
  });

  it('says nothing when the reader dismissed the administrator prompt', () => {
    expect(pathCommandStep('install', { kind: 'cancelled' })).toBe('nothing');
    expect(pathCommandStep('uninstall', { kind: 'cancelled' })).toBe('nothing');
  });

  it('names the action that failed', () => {
    expect(pathCommandStep('install', { kind: 'failed', message: 'x' })).toEqual({
      tell: { key: 'pathCommandInstallFailed', params: { error: 'x' }, failure: true },
    });
    expect(pathCommandStep('uninstall', { kind: 'failed', message: 'x' })).toEqual({
      tell: { key: 'pathCommandUninstallFailed', params: { error: 'x' }, failure: true },
    });
  });

  it('points at where mallow is running from when that will not last', () => {
    expect(pathCommandStep('install', { kind: 'unsettled', binary: '/Volumes/mallow/mallow.app' })).toEqual({
      tell: { key: 'pathCommandUnsettled', params: { path: '/Volumes/mallow/mallow.app' }, failure: true },
    });
  });

  it('reports a completed install or removal as a success', () => {
    expect(pathCommandStep('install', { kind: 'installed', path })).toMatchObject({ tell: { failure: false } });
    expect(pathCommandStep('uninstall', { kind: 'removed', path })).toMatchObject({ tell: { failure: false } });
    expect(pathCommandStep('uninstall', { kind: 'absent', path })).toMatchObject({ tell: { failure: false } });
  });
});
