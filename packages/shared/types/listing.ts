export type ListingCategory = 'textbooks' | 'electronics' | 'furniture' | 'tickets' | 'other';

export type ListingStatus = 'active' | 'sold' | 'inactive';

export interface Listing {
  _id: string;
  _creationTime: number;
  title: string;
  description: string;
  price: number;
  sellerEmail: string;
  category: ListingCategory;
  status: ListingStatus;
  createdAt: number;
}

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  sellerEmail: string;
  category: ListingCategory;
}
