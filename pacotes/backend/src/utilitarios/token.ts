import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'segredo_padrao_dev';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const gerarToken = (payload: object): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as any });
};

export const verificarToken = (token: string): any => {
  try {
    return jwt.verify(token, SECRET);
  } catch (erro) {
    return null;
  }
};
