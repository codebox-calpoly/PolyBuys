/* eslint-disable @typescript-eslint/no-explicit-any */
import schema from '../schema';

describe('Convex schema', () => {
  const schemaJson = JSON.parse((schema as any).export());
  const listings = schemaJson.tables.find((table: any) => table.tableName === 'listings');

  it('defines the listings table', () => {
    expect(listings).toBeDefined();
  });

  it('has required listing fields', () => {
    const fields = Object.keys(listings.documentType.value);
    expect(fields).toEqual([
      'title',
      'description',
      'price',
      'sellerEmail',
      'category',
      'status',
      'createdAt',
    ]);
  });

  it('enforces category and status enums', () => {
    const { fieldType: category } = listings.documentType.value.category;
    const categoryLiterals = category.value.map((v: any) => v.value);
    expect(categoryLiterals).toEqual(['textbooks', 'electronics', 'furniture', 'tickets', 'other']);

    const { fieldType: status } = listings.documentType.value.status;
    const statusLiterals = status.value.map((v: any) => v.value);
    expect(statusLiterals).toEqual(['active', 'sold', 'inactive']);
  });

  it('exposes indexes and search index for listings', () => {
    const indexNames = listings.indexes.map((i: any) => i.indexDescriptor);
    expect(indexNames).toContain('by_status');
    expect(indexNames).toContain('by_category');

    const statusIndex = listings.indexes.find((i: any) => i.indexDescriptor === 'by_status');
    expect(statusIndex.fields).toEqual(['status']);

    const categoryIndex = listings.indexes.find((i: any) => i.indexDescriptor === 'by_category');
    expect(categoryIndex.fields).toEqual(['category']);

    const searchIndex = listings.searchIndexes.find(
      (i: any) => i.indexDescriptor === 'search_title'
    );
    expect(searchIndex.searchField).toBe('title');
  });
});
