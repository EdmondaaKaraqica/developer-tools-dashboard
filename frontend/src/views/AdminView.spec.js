import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AdminView from './AdminView.vue';

vi.mock('../api.js', () => ({
  login: vi.fn(),
  fetchLinks: vi.fn(),
  authFetch: vi.fn(),
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
}));

import { login, fetchLinks, setToken } from '../api.js';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AdminView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('logs in and loads links', async () => {
    login.mockResolvedValue({ access_token: 't' });
    fetchLinks.mockResolvedValue({ items: [], totalPages: 1 });

    const w = mount(AdminView);
    // Fill password and click sign in
    const inputs = w.findAll('input');
    await inputs[1].setValue('password');
    await w.find('button').trigger('click');

    await flushPromises();
    expect(login).toHaveBeenCalled();
    expect(setToken).toHaveBeenCalledWith('t');
    expect(fetchLinks).toHaveBeenCalled();
  });
});

