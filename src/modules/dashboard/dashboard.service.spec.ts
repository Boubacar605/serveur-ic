import { RoleEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AdminDashboardBuilder } from './dashboard-admin.builder';
import { DashboardAgentBuilder } from './dashboard-agent.builder';
import { DashboardRecruiterBuilder } from './dashboard-recruiter.builder';
import { DashboardWorkerBuilder } from './dashboard-worker.builder';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const workerBuilder = { build: jest.fn() };
  const recruiterBuilder = { build: jest.fn() };
  const agentBuilder = { build: jest.fn() };
  const adminBuilder = { build: jest.fn() };
  let service: DashboardService;

  const userFor = (role: RoleEnum): CurrentUserPayload => ({
    id: 'user-id',
    email: 'user@example.com',
    role,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      workerBuilder as unknown as DashboardWorkerBuilder,
      recruiterBuilder as unknown as DashboardRecruiterBuilder,
      agentBuilder as unknown as DashboardAgentBuilder,
      adminBuilder as unknown as DashboardAdminBuilder,
    );
    workerBuilder.build.mockResolvedValue({ role: RoleEnum.TRAVAILLEUR, stats: { applicationsTotal: 2 } });
    recruiterBuilder.build.mockResolvedValue({ role: RoleEnum.RECRUTEUR, stats: { activeMissions: 3 } });
    agentBuilder.build.mockResolvedValue({ role: RoleEnum.AGENT, stats: { workersManaged: 4 } });
    adminBuilder.build.mockResolvedValue({ role: RoleEnum.ADMINISTRATEUR, stats: { workersRegistered: 5 } });
  });

  it('builds the worker dashboard from the JWT role', async () => {
    const user = userFor(RoleEnum.TRAVAILLEUR);
    await expect(service.getDashboard(user)).resolves.toMatchObject({ role: RoleEnum.TRAVAILLEUR });
    expect(workerBuilder.build).toHaveBeenCalledWith(user);
    expect(recruiterBuilder.build).not.toHaveBeenCalled();
  });

  it('builds the recruiter dashboard from the JWT role', async () => {
    const user = userFor(RoleEnum.RECRUTEUR);
    await expect(service.getDashboard(user)).resolves.toMatchObject({ role: RoleEnum.RECRUTEUR });
    expect(recruiterBuilder.build).toHaveBeenCalledWith(user);
  });

  it('builds the agent dashboard from the JWT role', async () => {
    const user = userFor(RoleEnum.AGENT);
    await expect(service.getDashboard(user)).resolves.toMatchObject({ role: RoleEnum.AGENT });
    expect(agentBuilder.build).toHaveBeenCalledWith(user);
  });

  it('builds the admin dashboard from the JWT role', async () => {
    const user = userFor(RoleEnum.ADMINISTRATEUR);
    await expect(service.getDashboard(user)).resolves.toMatchObject({ role: RoleEnum.ADMINISTRATEUR });
    expect(adminBuilder.build).toHaveBeenCalledWith(user);
  });
});
