
import { Router, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// ==========================================
// GET /api/statistics
// Statistik toko: jumlah player, hero yang dimiliki,
// total diamond, hero terpopuler, dan hero per role
// ==========================================
router.get('/', async (req, res, next: NextFunction) => {
  try {
    const [
      totalPlayers,
      totalHeroesOwned,
      diamondAggregate,
      mostOwnedGroups,
      heroesPerRoleGroups,
    ] = await Promise.all([
      // 1. Jumlah player
      prisma.player.count(),

      // 2. Jumlah data di tabel PlayerHero
      prisma.playerHero.count(),

      // 3. Total saldo diamond semua player
      prisma.player.aggregate({
        _sum: {
          diamond: true,
        },
      }),

      // 4. Hero yang paling banyak dimiliki player
      prisma.playerHero.groupBy({
        by: ['heroId'],
        _count: {
          heroId: true,
        },
        orderBy: {
          _count: {
            heroId: 'desc',
          },
        },
        take: 1,
      }),

      // 5. Jumlah hero untuk setiap role
      prisma.hero.groupBy({
        by: ['role'],
        _count: {
          role: true,
        },
        orderBy: {
          _count: {
            role: 'desc',
          },
        },
      }),
    ]);

    // Ambil nama hero yang paling banyak dimiliki
    let mostOwnedHero = null;

    if (mostOwnedGroups.length > 0) {
      const hero = await prisma.hero.findUnique({
        where: {
          id: mostOwnedGroups[0].heroId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (hero) {
        mostOwnedHero = {
          heroId: hero.id,
          name: hero.name,
          ownerCount: mostOwnedGroups[0]._count.heroId,
        };
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil data statistik',
      data: {
        totalPlayers,
        totalHeroesOwned,
        totalDiamond: diamondAggregate._sum.diamond ?? 0,
        mostOwnedHero,
        heroesPerRole: heroesPerRoleGroups.map((group) => ({
          role: group.role,
          total: group._count.role,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
