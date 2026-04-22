import { prisma } from '@flowdesk/db';
import { Prisma, TenantUserRole } from '@prisma/client';

const ROLE_PRIORITY: Record<TenantUserRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  AGENT: 2,
  VIEWER: 3,
};

type TenantUserWithTenant = Prisma.TenantUserGetPayload<{
  include: {
    tenant: {
      select: {
        id: true;
        name: true;
        slug: true;
        plan: true;
        isActive: true;
      };
    };
  };
}>;

function toTimestamp(value: Date | null | undefined): number {
  return value ? value.getTime() : 0;
}

function sortTenantUsers(users: TenantUserWithTenant[], preferredTenantId?: string | null): TenantUserWithTenant[] {
  return [...users].sort((left, right) => {
    const leftPreferred = preferredTenantId && left.tenantId === preferredTenantId ? 1 : 0;
    const rightPreferred = preferredTenantId && right.tenantId === preferredTenantId ? 1 : 0;

    if (leftPreferred !== rightPreferred) {
      return rightPreferred - leftPreferred;
    }

    const leftRole = ROLE_PRIORITY[left.role];
    const rightRole = ROLE_PRIORITY[right.role];
    if (leftRole !== rightRole) {
      return leftRole - rightRole;
    }

    const loginDelta = toTimestamp(right.lastLoginAt) - toTimestamp(left.lastLoginAt);
    if (loginDelta !== 0) {
      return loginDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export async function resolveTenantUserForEmail(email: string, preferredTenantId?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();

  const tenantUsers = await prisma.tenantUser.findMany({
    where: { email: normalizedEmail, isActive: true },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          isActive: true,
        },
      },
    },
  });

  const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.tenant.isActive);
  const sorted = sortTenantUsers(
    activeTenantUsers.length > 0 ? activeTenantUsers : tenantUsers,
    preferredTenantId
  );

  return {
    selected: sorted[0] || null,
    candidates: sorted,
  };
}
