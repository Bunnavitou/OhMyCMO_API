import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import postRoutes from './post.routes.js';
import subUserRoutes from './subUser.routes.js';
import customerRoutes from './customer.routes.js';
import customerGroupRoutes from './customerGroup.routes.js';
import productRoutes from './product.routes.js';
import partnerRoutes from './partner.routes.js';
import campaignRoutes from './campaign.routes.js';
import assetRoutes from './asset.routes.js';
import fileRoutes from './file.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/sub-users', subUserRoutes);
router.use('/customers', customerRoutes);
router.use('/customer-groups', customerGroupRoutes);
router.use('/products', productRoutes);
router.use('/partners', partnerRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/assets', assetRoutes);
router.use('/files', fileRoutes);

export default router;
