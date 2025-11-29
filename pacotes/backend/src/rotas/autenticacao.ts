import { Router } from 'express';
import { ServicoAutenticacao } from '../servicos/autenticacao';
import { z } from 'zod';

const router = Router();
const servicoAuth = new ServicoAutenticacao();

router.post('/login', async (req, res) => {
  try {
    const resultado = await servicoAuth.login(req.body);
    res.json(resultado);
  } catch (erro: any) {
    res.status(401).json({ erro: erro.message });
  }
});

router.post('/registrar', async (req, res) => {
  try {
    const resultado = await servicoAuth.registrar(req.body);
    res.status(201).json(resultado);
  } catch (erro: any) {
    res.status(400).json({ erro: erro.message });
  }
});

export default router;
