import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateQuackDto } from './create-quack.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (poll: unknown): Promise<CreateQuackDto> =>
  pipe.transform(
    { text: 'Lunch?', poll },
    { type: 'body', metatype: CreateQuackDto },
  );

describe('Poll creation validation', () => {
  it('trims the question and options before validation', async () => {
    const result = await validate({
      question: '  Where?  ',
      options: ['  Pizza ', ' Soup  '],
    });
    expect(result.poll).toEqual({
      question: 'Where?',
      options: ['Pizza', 'Soup'],
    });
  });
  it.each([
    null,
    { question: ' ', options: ['A', 'B'] },
    { question: 'x'.repeat(281), options: ['A', 'B'] },
    { question: 'Q', options: ['A'] },
    { question: 'Q', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
    { question: 'Q', options: [' Pizza ', 'pizza'] },
    { question: 'Q', options: ['A', '  '] },
    { question: 'Q', options: ['A', 'x'.repeat(101)] },
    { question: 'Q', options: ['A', 12] },
    { question: 'Q', options: ['A', 'B'], userId: 'spoofed' },
  ])('rejects an invalid poll: %j', async (poll) => {
    await expect(validate(poll)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('accepts the maximum lengths', async () => {
    await expect(
      validate({
        question: 'Q'.repeat(280),
        options: ['A'.repeat(100), 'B'.repeat(100)],
      }),
    ).resolves.toBeDefined();
  });
});
