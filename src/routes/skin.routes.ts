
import { Router, NextFunction } from 'express';
import { Prisma, Rarity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import HttpError from '../middlewares/http-error';

const router = Router();

// ==========================================
// GET /api/skins
// Mengambil semua skin dengan pagination
// ==========================================
router.get('/', async (req, res, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const heroId = req.query.heroId
      ? Number(req.query.heroId)
      : undefined;

    const rarity = req.query.rarity?.toString().toUpperCase();

    // Validasi pagination
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1
    ) {
      throw new HttpError(
        400,
        'Page dan limit harus berupa bilangan bulat positif'
      );
    }

    // Menyiapkan filter
    const where: Prisma.SkinWhereInput = {};

    if (heroId !== undefined) {
      if (!Number.isInteger(heroId) || heroId < 1) {
        throw new HttpError(400, 'Hero ID tidak valid');
      }

      where.heroId = heroId;
    }

    if (rarity) {
      if (!Object.values(Rarity).includes(rarity as Rarity)) {
        throw new HttpError(400, 'Rarity tidak valid');
      }

      where.rarity = rarity as Rarity;
    }

    // Mengambil data Skin dan jumlah seluruh hasil
    const [skins, totalItems] = await Promise.all([
      prisma.skin.findMany({
        where,
        include: {
          hero: {
            select: {
              name: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          id: 'asc',
        },
      }),
      prisma.skin.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil daftar skin',
      data: skins,
      metadata: {
        currentPage: page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/skins/:skin_id
// Mengambil detail skin beserta hero
// ==========================================
router.get('/:skin_id', async (req, res, next: NextFunction) => {
  try {
    const skinId = Number(req.params.skin_id);

    if (!Number.isInteger(skinId) || skinId < 1) {
      throw new HttpError(400, 'Skin ID tidak valid');
    }

    const skin = await prisma.skin.findUnique({
      where: {
        id: skinId,
      },
      include: {
        hero: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!skin) {
      throw new HttpError(404, 'Skin tidak ditemukan');
    }

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil detail skin',
      data: skin,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
