import { DataSource } from 'typeorm';
import { VerificationCodeRepository } from '../verification-code.repository';

describe('VerificationCodeRepository', () => {
  let repository: VerificationCodeRepository;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource.getRepository.mockReturnValue(mockRepository);

    repository = new VerificationCodeRepository(
      mockDataSource as unknown as DataSource
    );
  });

  describe('deleteOlderThan', () => {
    it('should delete codes created before the cutoff', async () => {
      const cutoff = new Date('2024-01-14T12:00:00Z');

      const execute = jest.fn().mockResolvedValue({ affected: 5 });
      const where = jest.fn().mockReturnValue({ execute });
      const deleteBuilder = jest.fn().mockReturnValue({ where });

      mockRepository.createQueryBuilder.mockReturnValue({
        delete: deleteBuilder
      });

      const result = await repository.deleteOlderThan(cutoff);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(deleteBuilder).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledWith('"createdAt" < :cutoff', { cutoff });
      expect(execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(5);
    });

    it('should return 0 when no rows are deleted', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: undefined });
      const where = jest.fn().mockReturnValue({ execute });
      const deleteBuilder = jest.fn().mockReturnValue({ where });

      mockRepository.createQueryBuilder.mockReturnValue({
        delete: deleteBuilder
      });

      const result = await repository.deleteOlderThan(
        new Date('2024-01-14T12:00:00Z')
      );

      expect(result).toBe(0);
    });
  });
});
