import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ensureUploadsDir } from '../lib/uploads';
import {
  DEMO_FUNERAL_HOME_EMAIL,
  DEMO_FUNERAL_HOME_NAME,
  DEMO_SLUG,
  demoAnnouncements,
  demoBiography,
  demoFuneralHome,
  demoLocations,
  demoMemorialCore,
  demoPhotos,
  demoProgramme,
  demoSettings,
  demoTributes,
} from '../lib/demoMemorial';

function sourceAssetsDir() {
  return path.resolve(process.cwd(), 'prisma', 'demo-assets', 'photos');
}

function copyDemoAssets() {
  const source = sourceAssetsDir();
  if (!fs.existsSync(source)) {
    throw new Error(`Demo source media directory is missing: ${source}`);
  }
  const target = ensureUploadsDir(DEMO_SLUG);
  let totalBytes = 0;

  for (const photo of demoPhotos) {
    const fileName = path.basename(photo.url);
    const sourceFile = path.join(source, fileName);
    const targetFile = path.join(target, fileName);
    if (!fs.existsSync(sourceFile)) throw new Error(`Demo source media is missing: ${sourceFile}`);
    fs.copyFileSync(sourceFile, targetFile);
    totalBytes += fs.statSync(targetFile).size;
  }

  return totalBytes;
}

async function main() {
  const storageBytes = copyDemoAssets();
  const existing = await prisma.memorial.findUnique({ where: { slug: DEMO_SLUG }, select: { id: true, isDemo: true } });
  if (existing && !existing.isDemo) {
    throw new Error(`Refusing to overwrite non-demo memorial with slug "${DEMO_SLUG}" (${existing.id}).`);
  }

  const funeralHome = await prisma.funeralHome.upsert({
    where: { email: DEMO_FUNERAL_HOME_EMAIL },
    create: {
      name: DEMO_FUNERAL_HOME_NAME,
      email: DEMO_FUNERAL_HOME_EMAIL,
      phone: demoFuneralHome.phone,
      address: demoFuneralHome.address,
      tradingName: demoFuneralHome.tradingName,
      logoUrl: demoFuneralHome.logoUrl,
      iconUrl: demoFuneralHome.iconUrl,
      primaryColor: demoFuneralHome.primaryColor,
      secondaryColor: demoFuneralHome.secondaryColor,
      accentColor: demoFuneralHome.accentColor,
      backgroundColor: demoFuneralHome.backgroundColor,
      textColor: demoFuneralHome.textColor,
      fontFamily: demoFuneralHome.fontFamily,
      buttonStyle: demoFuneralHome.buttonStyle,
      cardStyle: demoFuneralHome.cardStyle,
      borderRadius: demoFuneralHome.borderRadius,
      whatsapp: demoFuneralHome.whatsapp,
      websiteUrl: demoFuneralHome.websiteUrl,
      facebookUrl: demoFuneralHome.facebookUrl,
      instagramUrl: demoFuneralHome.instagramUrl,
      footerText: demoFuneralHome.footerText,
      copyrightText: demoFuneralHome.copyrightText,
      whiteLabelEnabled: demoFuneralHome.whiteLabelEnabled,
      themeTemplate: demoFuneralHome.themeTemplate,
      memorialStyle: demoFuneralHome.memorialStyle,
      animationLevel: demoFuneralHome.animationLevel,
      galleryLayout: demoFuneralHome.galleryLayout,
      timelineStyle: demoFuneralHome.timelineStyle,
      programmeStyle: demoFuneralHome.programmeStyle,
    },
    update: {
      name: DEMO_FUNERAL_HOME_NAME,
      phone: demoFuneralHome.phone,
      address: demoFuneralHome.address,
      tradingName: demoFuneralHome.tradingName,
      logoUrl: demoFuneralHome.logoUrl,
      iconUrl: demoFuneralHome.iconUrl,
      primaryColor: demoFuneralHome.primaryColor,
      secondaryColor: demoFuneralHome.secondaryColor,
      accentColor: demoFuneralHome.accentColor,
      backgroundColor: demoFuneralHome.backgroundColor,
      textColor: demoFuneralHome.textColor,
      fontFamily: demoFuneralHome.fontFamily,
      buttonStyle: demoFuneralHome.buttonStyle,
      cardStyle: demoFuneralHome.cardStyle,
      borderRadius: demoFuneralHome.borderRadius,
      whatsapp: demoFuneralHome.whatsapp,
      websiteUrl: demoFuneralHome.websiteUrl,
      facebookUrl: demoFuneralHome.facebookUrl,
      instagramUrl: demoFuneralHome.instagramUrl,
      footerText: demoFuneralHome.footerText,
      copyrightText: demoFuneralHome.copyrightText,
      whiteLabelEnabled: demoFuneralHome.whiteLabelEnabled,
      themeTemplate: demoFuneralHome.themeTemplate,
      memorialStyle: demoFuneralHome.memorialStyle,
      animationLevel: demoFuneralHome.animationLevel,
      galleryLayout: demoFuneralHome.galleryLayout,
      timelineStyle: demoFuneralHome.timelineStyle,
      programmeStyle: demoFuneralHome.programmeStyle,
    },
  });

  const memorial = await prisma.memorial.upsert({
    where: { slug: DEMO_SLUG },
    create: {
      slug: DEMO_SLUG,
      deceasedName: demoMemorialCore.deceasedName,
      dateOfBirth: new Date(demoMemorialCore.dateOfBirth),
      dateOfDeath: new Date(demoMemorialCore.dateOfDeath),
      serviceDate: new Date(demoMemorialCore.serviceDate),
      serviceVenue: demoMemorialCore.serviceVenue,
      deceasedPhotoUrl: demoMemorialCore.deceasedPhotoUrl,
      obituary: demoMemorialCore.obituary,
      biography: demoBiography as Prisma.InputJsonValue,
      programme: demoProgramme as Prisma.InputJsonValue,
      currentProgrammeIndex: demoMemorialCore.currentProgrammeIndex,
      announcements: demoAnnouncements as Prisma.InputJsonValue,
      settings: demoSettings as Prisma.InputJsonValue,
      status: demoMemorialCore.status,
      isDemo: true,
      paymentStatus: demoMemorialCore.paymentStatus,
      publishedAt: new Date(demoMemorialCore.publishedAt),
      publicExpiresAt: null,
      deleteAfter: null,
      funeralHomeId: funeralHome.id,
      storageBytes,
    },
    update: {
      deceasedName: demoMemorialCore.deceasedName,
      dateOfBirth: new Date(demoMemorialCore.dateOfBirth),
      dateOfDeath: new Date(demoMemorialCore.dateOfDeath),
      serviceDate: new Date(demoMemorialCore.serviceDate),
      serviceVenue: demoMemorialCore.serviceVenue,
      deceasedPhotoUrl: demoMemorialCore.deceasedPhotoUrl,
      obituary: demoMemorialCore.obituary,
      biography: demoBiography as Prisma.InputJsonValue,
      programme: demoProgramme as Prisma.InputJsonValue,
      currentProgrammeIndex: demoMemorialCore.currentProgrammeIndex,
      announcements: demoAnnouncements as Prisma.InputJsonValue,
      settings: demoSettings as Prisma.InputJsonValue,
      status: demoMemorialCore.status,
      isDemo: true,
      paymentStatus: demoMemorialCore.paymentStatus,
      paymentId: null,
      publishedAt: new Date(demoMemorialCore.publishedAt),
      editLocksAt: null,
      publicExpiresAt: null,
      deleteAfter: null,
      deletedAt: null,
      videosDeletedAt: null,
      funeralHomeId: funeralHome.id,
      storageBytes,
    },
  });

  await prisma.$transaction([
    prisma.photo.deleteMany({ where: { memorialId: memorial.id } }),
    prisma.tribute.deleteMany({ where: { memorialId: memorial.id } }),
    prisma.memorialLocation.deleteMany({ where: { memorialId: memorial.id } }),
    prisma.familyInvitation.deleteMany({ where: { memorialId: memorial.id } }),
    prisma.memorialAccess.deleteMany({ where: { memorialId: memorial.id } }),
    prisma.memorialView.deleteMany({ where: { memorialId: memorial.id } }),
  ]);

  await prisma.photo.createMany({
    data: demoPhotos.map((photo) => ({
      memorialId: memorial.id,
      url: photo.url,
      caption: photo.caption,
      category: photo.category,
      mediaType: photo.mediaType,
      order: photo.order,
      storageBytes: fs.statSync(path.join(ensureUploadsDir(DEMO_SLUG), path.basename(photo.url))).size,
    })),
  });
  await prisma.memorialLocation.createMany({
    data: demoLocations.map((location) => ({
      memorialId: memorial.id,
      type: location.type,
      name: location.name,
      addressText: location.addressText,
      latitude: location.latitude,
      longitude: location.longitude,
      notes: location.notes,
      orderIndex: location.orderIndex,
    })),
  });
  await prisma.tribute.createMany({
    data: demoTributes.map((tribute) => ({
      memorialId: memorial.id,
      authorName: tribute.authorName,
      message: tribute.message,
      approved: true,
      createdAt: new Date(tribute.createdAt),
    })),
  });

  console.log(`Seeded permanent demo memorial "${DEMO_SLUG}" with ${demoPhotos.length} photos, ${demoProgramme.length} programme items, ${demoLocations.length} locations, and ${demoTributes.length} tributes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
