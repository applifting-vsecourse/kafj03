import { IsIn } from 'class-validator';

export class SearchUsageDto {
  @IsIn(['feed', 'search', 'open'])
  event!: 'feed' | 'search' | 'open';
}
