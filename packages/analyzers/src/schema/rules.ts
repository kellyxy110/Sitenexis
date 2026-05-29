import { type SchemaType } from '@sitenexis/shared';

export interface SchemaRule {
  required: string[];
  recommended: string[];
  /** Field-level type expectations: field name → expected type description */
  fieldTypes?: Record<string, string>;
}

export const SCHEMA_RULES: Record<SchemaType, SchemaRule> = {
  Organization: {
    required: ['name', 'url'],
    recommended: ['logo', 'contactPoint', 'sameAs', 'address', 'description'],
    fieldTypes: {
      name: 'string',
      url: 'string (URL)',
      logo: 'ImageObject or string (URL)',
      sameAs: 'string[] (URLs)',
    },
  },
  LocalBusiness: {
    required: ['name', 'address', 'telephone'],
    recommended: ['openingHours', 'geo', 'priceRange', 'image', 'url', 'sameAs'],
    fieldTypes: {
      address: 'PostalAddress object',
      telephone: 'string',
      geo: 'GeoCoordinates object',
    },
  },
  WebSite: {
    required: ['name', 'url'],
    recommended: ['description', 'potentialAction', 'publisher'],
    fieldTypes: {
      url: 'string (URL)',
      potentialAction: 'SearchAction object',
    },
  },
  WebPage: {
    required: ['name', 'url'],
    recommended: ['description', 'breadcrumb', 'dateModified', 'author'],
    fieldTypes: {
      url: 'string (URL)',
      breadcrumb: 'BreadcrumbList object',
    },
  },
  Article: {
    required: ['headline', 'author', 'datePublished', 'image', 'publisher'],
    recommended: ['description', 'dateModified', 'articleBody', 'keywords'],
    fieldTypes: {
      headline: 'string (max 110 chars)',
      author: 'Person or Organization object',
      datePublished: 'string (ISO 8601)',
      image: 'ImageObject or string (URL)',
      publisher: 'Organization object',
    },
  },
  BlogPosting: {
    required: ['headline', 'author', 'datePublished', 'image', 'publisher'],
    recommended: ['description', 'dateModified', 'articleBody', 'keywords'],
    fieldTypes: {
      headline: 'string (max 110 chars)',
      author: 'Person or Organization object',
      datePublished: 'string (ISO 8601)',
      image: 'ImageObject or string (URL)',
      publisher: 'Organization object',
    },
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
    fieldTypes: {
      mainEntity: 'Question[] with acceptedAnswer',
    },
  },
  Product: {
    required: ['name', 'image', 'description', 'offers'],
    recommended: ['sku', 'brand', 'aggregateRating', 'review', 'gtin'],
    fieldTypes: {
      image: 'ImageObject or string[] (URLs)',
      offers: 'Offer or AggregateOffer object with price, priceCurrency, availability',
      brand: 'Brand or Organization object',
    },
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
    fieldTypes: {
      itemListElement: 'ListItem[] with item, name, position',
    },
  },
  Person: {
    required: ['name'],
    recommended: ['jobTitle', 'worksFor', 'url', 'sameAs', 'image'],
    fieldTypes: {
      worksFor: 'Organization object',
      sameAs: 'string[] (URLs)',
    },
  },
  Event: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'organizer', 'image', 'offers', 'eventStatus'],
    fieldTypes: {
      startDate: 'string (ISO 8601)',
      endDate: 'string (ISO 8601)',
      location: 'Place or VirtualLocation object',
    },
  },
  Review: {
    required: ['reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished', 'itemReviewed'],
    fieldTypes: {
      reviewRating: 'Rating object with ratingValue',
      author: 'Person or Organization object',
    },
  },
  HowTo: {
    required: ['name', 'step'],
    recommended: ['description', 'totalTime', 'image', 'tool', 'supply'],
    fieldTypes: {
      step: 'HowToStep[] with text and name',
      totalTime: 'string (ISO 8601 duration)',
    },
  },
  VideoObject: {
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'duration', 'embedUrl', 'publisher'],
    fieldTypes: {
      uploadDate: 'string (ISO 8601)',
      duration: 'string (ISO 8601 duration)',
    },
  },
  ImageObject: {
    required: ['url'],
    recommended: ['width', 'height', 'caption', 'author'],
    fieldTypes: {
      url: 'string (URL)',
      width: 'integer (pixels)',
      height: 'integer (pixels)',
    },
  },
};
