
import { Router, NextFunction } from 'express';
import { Prisma, Role, Lane } from '@prisma/client';
import { prisma } from '../lib/prisma';
import HttpError from '../middlewares/http-error';

const router = Router();

// ==========================================
// GET /api/heroes
// Mengambil semua hero dengan pagination
// ==========================================
router.get('/', async (req, res, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search?.toString();
    const role = req.query.role?.toString().toUpperCase();

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

    const where: Prisma.HeroWhereInput = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      if (!Object.values(Role).includes(role as Role)) {
        throw new HttpError(400, 'Role tidak valid');
      }

      where.role = role as Role;
    }

    const [heroes, totalItems] = await Promise.all([
      prisma.hero.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          id: 'asc',
        },
      }),

      prisma.hero.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil daftar hero',
      data: heroes,
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
// GET /api/heroes/:hero_id
// Mengambil detail hero beserta skins
// ==========================================
router.get('/:hero_id', async (req, res, next: NextFunction) => {
  try {
    const heroId = Number(req.params.hero_id);

    if (!Number.isInteger(heroId) || heroId < 1) {
      throw new HttpError(400, 'Hero ID tidak valid');
    }

    const hero = await prisma.hero.findUnique({
      where: {
        id: heroId,
      },
      include: {
        skins: true,
      },
    });

    if (!hero) {
      throw new HttpError(404, 'Hero tidak ditemukan');
    }

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil detail hero',
      data: hero,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/heroes
// Menambahkan hero baru
// ==========================================
router.post('/', async (req, res, next: NextFunction) => {
  try {
    const {
      name,
      role,
      lane,
      releaseYear,
      priceBp,
      priceDiamond,
    } = req.body;

    // Validasi field wajib
    if (
      typeof name !== 'string' ||
      name.trim() === '' ||
      !role ||
      !lane ||
      releaseYear === undefined ||
      releaseYear === null
    ) {
      throw new HttpError(
        400,
        'Name, role, lane, dan releaseYear wajib diisi'
      );
    }

    // Validasi role
    if (!Object.values(Role).includes(role)) {
      throw new HttpError(400, 'Role tidak valid');
    }

    // Validasi lane
    if (!Object.values(Lane).includes(lane)) {
      throw new HttpError(400, 'Lane tidak valid');
    }

    // Validasi angka
    if (!Number.isInteger(releaseYear)) {
      throw new HttpError(
        400,
        'Release year harus berupa bilangan bulat'
      );
    }

    if (
      (priceBp !== undefined &&
        priceBp !== null &&
        !Number.isInteger(priceBp)) ||
      (priceDiamond !== undefined &&
        priceDiamond !== null &&
        !Number.isInteger(priceDiamond))
    ) {
      throw new HttpError(
        400,
        'Harga harus berupa bilangan bulat'
      );
    }

    // Memeriksa apakah nama hero sudah digunakan
    const existingHero = await prisma.hero.findUnique({
      where: {
        name: name.trim(),
      },
    });

    if (existingHero) {
      throw new HttpError(
        409,
        'Hero dengan nama tersebut sudah tersedia'
      );
    }

    // Menyimpan hero baru ke database
    const newHero = await prisma.hero.create({
      data: {
        name: name.trim(),
        role,
        lane,
        releaseYear,
        priceBp: priceBp ?? null,
        priceDiamond: priceDiamond ?? null,
      },
    });

    return res.status(201).json({
      status: true,
      message: 'Hero berhasil ditambahkan',
      data: newHero,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
