import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { getRepositories } from '@/lib/db/repositories';
import { getHousehold } from '@/lib/db/repositories/household';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import en from '@/lib/i18n/messages/en.json';
import { useDeviceStore } from '@/stores/deviceStore';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

function renderForm() {
  return render(
    <I18nProvider locale="en">
      <OnboardingForm />
    </I18nProvider>,
  );
}

describe('onboarding form', () => {
  beforeEach(() => {
    replace.mockClear();
    useDeviceStore.setState({ activeMemberId: null });
  });

  it('shows the threat-model disclosures verbatim', () => {
    renderForm();
    expect(screen.getByText(en.onboarding.pinDisclosure)).toBeInTheDocument();
    expect(screen.getByText(en.onboarding.storageDisclosure)).toBeInTheDocument();
  });

  it('validates the name and PIN without touching the database', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Parent PIN/), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.submit }));
    expect(await screen.findByText(en.onboarding.errors.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(en.onboarding.errors.pinInvalid)).toBeInTheDocument();
    expect(await getHousehold(getRepositories().core.db)).toBeUndefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('creates the vault with only a name, sets the active profile and opens Today', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(en.onboarding.yourName), { target: { value: 'Lotte' } });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.addMember }));
    fireEvent.change(screen.getByLabelText(en.onboarding.memberName), {
      target: { value: 'Daan' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.submit }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    const repos = getRepositories();
    const household = await getHousehold(repos.core.db);
    expect(household?.householdName).toBe(en.onboarding.defaultHouseholdName);
    const members = await repos.members.list();
    expect(members.map((m) => [m.name, m.role]).sort()).toEqual([
      ['Daan', 'child'],
      ['Lotte', 'parent'],
    ]);
    const lotte = members.find((m) => m.name === 'Lotte');
    expect(useDeviceStore.getState().activeMemberId).toBe(lotte?.id);
  });
});
