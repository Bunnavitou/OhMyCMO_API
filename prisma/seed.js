import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('1234', 10);
  const alicePassword = await bcrypt.hash('alice123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'yoman168' },
    update: { password: adminPassword },
    create: {
      username: 'yoman168',
      name: 'Owner',
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
    owner: admin.username,
    subUser: `${alice.username} (under ${admin.username})`,
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
