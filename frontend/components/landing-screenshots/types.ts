export type GalleryScreenshot = {
  id: string;
  src: string;
  alt: string;
  title: string;
};

export type LandingGalleryItem = {
  id: string;
  src: string;
  alt: string;
  title: string;
  caption: string;
  link?: { href: string; label: string };
};
