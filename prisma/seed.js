import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const alicePassword = await bcrypt.hash('alice123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ohmycmo.local' },
    update: {},
    create: {
      email: 'admin@ohmycmo.local',
      name: 'Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Sample sub-user under the admin tenant.
  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      username: 'alice',
      name: 'Alice',
      password: alicePassword,
      role: 'USER',
      ownerId: admin.id,
      permissions: {
        customers: true,
        products: true,
        partners: true,
        marketing: true,
        assets: true,
        subUsers: false,
      },
    },
  });

  console.log('Seed complete:', {
    owner: admin.email,
    subUser: `${alice.username} (under ${admin.email})`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
