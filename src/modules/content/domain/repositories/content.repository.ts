import { ContentBlockState } from 'src/modules/content/domain/entities/content-block.entity';

export interface CreateContentBlockRecord {
  id: string;
  title: string;
  slug?: string | null;
  type: 'banner' | 'hero' | 'text_section' | 'featured_brand';
  placementKey: string;
  body: unknown;
  isPublished?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priority?: number;
}

export interface UpdateContentBlockRecord extends Partial<CreateContentBlockRecord> {
  id: string;
}

export interface ContentRepository {
  create(data: CreateContentBlockRecord): Promise<ContentBlockState>;
  update(data: UpdateContentBlockRecord): Promise<ContentBlockState>;
  findById(id: string): Promise<ContentBlockState | null>;
  listAll(): Promise<ContentBlockState[]>;
  listVisible(placementKey?: string, at?: Date): Promise<ContentBlockState[]>;
}

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');
