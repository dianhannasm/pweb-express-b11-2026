import fs from "node:fs";
import path from "node:path";
import type { Lane, Rarity, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

type HeroJson = {
  id: number;
  name: string;
  primaryRole: string;
  primaryLane: string;
  releaseYear: number;
  priceBP: number | null;
  priceDiamond: number | null;
};

type SkinJson = {
  id: number;
  name: string;
  heroId: number;
  rarity: string;
  priceDiamond: number | null;
};

function loadJson<T>(fileName: string): T[] {
  const filePath = path.join(process.cwd(), "data", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T[];
}

async function main() {
  // 1. Kosongkan semua tabel; RESTART IDENTITY mengembalikan id ke angka 1.
  await prisma.$executeRawUnsafe(
    `TRUNCATE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE`,
  );

  const heroes = loadJson<HeroJson>("heroes.json");
  const skins = loadJson<SkinJson>("skins.json");

  // 2. Masukkan semua hero dengan createMany. Id tidak diisi karena
  // urutan di file sudah benar (Miya id 1, Hirara id 133).
  await prisma.hero.createMany({
    data: heroes.map((hero) => ({
      name: hero.name,
      role: hero.primaryRole as Role,
      lane: hero.primaryLane as Lane,
      releaseYear: hero.releaseYear,
      priceBp: hero.priceBP,
      priceDiamond: hero.priceDiamond,
    })),
  });

  // 3. Masukkan semua skin dengan createMany. Skin yang tidak bisa dibeli
  // (harga kosong) disimpan sebagai 0.
  await prisma.skin.createMany({
    data: skins.map((skin) => ({
      name: skin.name,
      heroId: skin.heroId,
      rarity: skin.rarity as Rarity,
      priceDiamond: skin.priceDiamond ?? 0,
    })),
  });

  // 4. Masukkan 3 player dan data PlayerHero dari tabel di modul.
  await prisma.player.createMany({
    data: [
      { id: 1, nickname: "AreakTS", bp: 1500, diamond: 75 },
      { id: 2, nickname: "SangPushRank", bp: 13000, diamond: 2892 },
      { id: 3, nickname: "MageSurabaya", bp: 10000, diamond: 0 },
    ],
  });

  await prisma.playerHero.createMany({
    data: [
      { playerId: 1, heroId: 18, currency: "BP", pricePaid: 2000 },
      { playerId: 1, heroId: 1, currency: "BP", pricePaid: 10800 },
      { playerId: 2, heroId: 84, currency: "DIAMOND", pricePaid: 599 },
      { playerId: 2, heroId: 56, currency: "BP", pricePaid: 32000 },
    ],
  });

  console.log(`Seed selesai: ${heroes.length} hero, ${skins.length} skin, 3 player.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
