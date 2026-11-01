
import { Router, NextFunction } from 'express';
import { Currency } from '@prisma/client';
import { prisma } from '../lib/prisma';
import HttpError from '../middlewares/http-error';

const router = Router();

// Mengecek apakah error berasal dari pelanggaran constraint unik (P2002)
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

// Membaca :player_id dari path parameter
function parsePlayerId(raw: string): number {
  const playerId = Number(raw);

  if (!Number.isInteger(playerId) || playerId < 1) {
    throw new HttpError(400, 'Player ID tidak valid');
  }

  return playerId;
}

// ==========================================
// POST /api/players
// Membuat player baru (saldo dari default schema)
// ==========================================
router.post('/', async (req, res, next: NextFunction) => {
  try {
    const { nickname } = req.body;

    // 1. nickname kosong -> 400
    if (typeof nickname !== 'string' || nickname.trim() === '') {
      throw new HttpError(400, 'Nickname tidak boleh kosong');
    }

    const trimmedNickname = nickname.trim();

    // 2. nickname sudah dipakai -> 409
    const existingPlayer = await prisma.player.findUnique({
      where: {
        nickname: trimmedNickname,
      },
    });

    if (existingPlayer) {
      throw new HttpError(409, 'Nickname sudah digunakan');
    }

    // 3. berhasil -> 201 (bp 10000 dan diamond 0 dari default schema)
    const newPlayer = await prisma.player.create({
      data: {
        nickname: trimmedNickname,
      },
    });

    return res.status(201).json({
      status: true,
      message: 'Player berhasil dibuat',
      data: newPlayer,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/players/:player_id
// Detail player beserta daftar hero yang dimilikinya
// ==========================================
router.get('/:player_id', async (req, res, next: NextFunction) => {
  try {
    const playerId = parsePlayerId(req.params.player_id);

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
      include: {
        playerHeroes: {
          include: {
            hero: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    // Diubah menjadi field "heroes" sesuai contoh response pada modul
    const { playerHeroes, ...playerData } = player;

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengambil data player',
      data: {
        ...playerData,
        heroes: playerHeroes.map((owned) => ({
          heroId: owned.heroId,
          name: owned.hero.name,
          currency: owned.currency,
          pricePaid: owned.pricePaid,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PATCH /api/players/:player_id
// Mengganti nickname player
// ==========================================
router.patch('/:player_id', async (req, res, next: NextFunction) => {
  try {
    const playerId = parsePlayerId(req.params.player_id);

    // 1. player tidak ada -> 404
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    const { nickname } = req.body;

    // 2. nickname kosong -> 400
    if (typeof nickname !== 'string' || nickname.trim() === '') {
      throw new HttpError(400, 'Nickname tidak boleh kosong');
    }

    const trimmedNickname = nickname.trim();

    // 3. nickname sudah dipakai player lain -> 409
    const existingPlayer = await prisma.player.findUnique({
      where: {
        nickname: trimmedNickname,
      },
    });

    if (existingPlayer && existingPlayer.id !== playerId) {
      throw new HttpError(409, 'Nickname sudah digunakan player lain');
    }

    const updatedPlayer = await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        nickname: trimmedNickname,
      },
    });

    return res.status(200).json({
      status: true,
      message: 'Player berhasil diperbarui',
      data: updatedPlayer,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// DELETE /api/players/:player_id
// Menghapus player beserta data PlayerHero miliknya
// ==========================================
router.delete('/:player_id', async (req, res, next: NextFunction) => {
  try {
    const playerId = parsePlayerId(req.params.player_id);

    // 1. player tidak ada -> 404
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    // 2. hapus player; PlayerHero ikut terhapus (onDelete: Cascade)
    const deletedPlayer = await prisma.player.delete({
      where: {
        id: playerId,
      },
    });

    return res.status(200).json({
      status: true,
      message: 'Player berhasil dihapus',
      data: deletedPlayer,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/players/:player_id/topup
// Menambah diamond player
// ==========================================
router.post('/:player_id/topup', async (req, res, next: NextFunction) => {
  try {
    const { amount } = req.body;

    // 1. amount bukan bilangan bulat lebih dari 0 -> 400
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(
        400,
        'Amount harus berupa bilangan bulat lebih dari 0'
      );
    }

    const playerId = parsePlayerId(req.params.player_id);

    // 2. player tidak ditemukan -> 404
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    // 3. tambah diamond dengan increment
    const updatedPlayer = await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        diamond: {
          increment: amount,
        },
      },
    });

    return res.status(200).json({
      status: true,
      message: 'Top up berhasil',
      data: {
        playerId,
        amount,
        diamond: updatedPlayer.diamond,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/players/:player_id/matches
// Menambah hadiah BP dari hasil match
// ==========================================
router.post('/:player_id/matches', async (req, res, next: NextFunction) => {
  try {
    const { result } = req.body;

    // 1. result bukan WIN/LOSE -> 400
    if (result !== 'WIN' && result !== 'LOSE') {
      throw new HttpError(400, 'Result harus WIN atau LOSE');
    }

    const playerId = parsePlayerId(req.params.player_id);

    // 2. player tidak ditemukan -> 404
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    // 3. tambah bp dengan increment (WIN 300, LOSE 100)
    const bpEarned = result === 'WIN' ? 300 : 100;

    const updatedPlayer = await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        bp: {
          increment: bpEarned,
        },
      },
    });

    return res.status(200).json({
      status: true,
      message: 'Hadiah match berhasil ditambahkan',
      data: {
        playerId,
        result,
        bpEarned,
        bp: updatedPlayer.bp,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/players/:player_id/heroes
// Membeli hero dengan BP atau Diamond
// ==========================================
router.post('/:player_id/heroes', async (req, res, next: NextFunction) => {
  try {
    const { currency, heroId: rawHeroId } = req.body;

    // 1. heroId kosong, atau currency bukan BP/DIAMOND -> 400
    const heroId =
      rawHeroId === undefined || rawHeroId === null || rawHeroId === ''
        ? NaN
        : Number(rawHeroId);

    if (!Number.isInteger(heroId) || heroId < 1) {
      throw new HttpError(400, 'Hero ID tidak valid');
    }

    if (currency !== Currency.BP && currency !== Currency.DIAMOND) {
      throw new HttpError(400, 'Currency harus BP atau DIAMOND');
    }

    const playerId = parsePlayerId(req.params.player_id);

    // 2. player tidak ditemukan -> 404
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      throw new HttpError(404, 'Player tidak ditemukan');
    }

    // 3. hero tidak ditemukan -> 404
    const hero = await prisma.hero.findUnique({
      where: {
        id: heroId,
      },
    });

    if (!hero) {
      throw new HttpError(404, 'Hero tidak ditemukan');
    }

    // 4. harga hero untuk currency tersebut kosong -> 400
    const price = currency === Currency.BP ? hero.priceBp : hero.priceDiamond;

    if (price === null || price === undefined) {
      throw new HttpError(
        400,
        `Hero ${hero.name} tidak bisa dibeli dengan ${currency}`
      );
    }

    // 5. player sudah memiliki hero tersebut -> 409
    const ownedHero = await prisma.playerHero.findUnique({
      where: {
        playerId_heroId: {
          playerId,
          heroId,
        },
      },
    });

    if (ownedHero) {
      throw new HttpError(409, 'Player sudah memiliki hero ini');
    }

    // 6. saldo player kurang dari harga hero -> 400
    const balance = currency === Currency.BP ? player.bp : player.diamond;

    if (balance < price) {
      throw new HttpError(400, `Saldo ${currency} tidak cukup`);
    }

    // Simpan dengan transaction: kurangi saldo lalu buat PlayerHero
    try {
      const [updatedPlayer, purchasedHero] = await prisma.$transaction([
        prisma.player.update({
          where: {
            id: playerId,
          },
          data:
            currency === Currency.BP
              ? { bp: { decrement: price } }
              : { diamond: { decrement: price } },
        }),

        prisma.playerHero.create({
          data: {
            playerId,
            heroId,
            currency,
            pricePaid: price,
          },
        }),
      ]);

      return res.status(201).json({
        status: true,
        message: 'Hero berhasil dibeli',
        data: {
          hero: {
            id: hero.id,
            name: hero.name,
          },
          currency: purchasedHero.currency,
          pricePaid: purchasedHero.pricePaid,
          balance: {
            bp: updatedPlayer.bp,
            diamond: updatedPlayer.diamond,
          },
        },
      });
    } catch (error) {
      // Pengaman race condition: unique constraint (playerId + heroId)
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'Player sudah memiliki hero ini');
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
