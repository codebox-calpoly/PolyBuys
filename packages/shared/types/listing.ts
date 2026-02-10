export type ListingCategory = 'textbooks' | 'electronics' | 'furniture' | 'tickets' | 'other';

export type ListingStatus = 'active' | 'sold' | 'inactive' | 'deleted';

export type ListingCondition = 'new' | 'used' | 'refurbished';

export interface Listing {
  _id: string;
  _creationTime: number;
  title: string;
  description: string;
  price: number;
  sellerEmail: string;
  sellerId: string;
  images: string[];
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  createdAt: number;
  postedOn: number;
  tags?: string[];
}

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  sellerEmail: string;
  category: ListingCategory;
  condition: ListingCondition;
  images: string[];
  tags?: string[];
}
