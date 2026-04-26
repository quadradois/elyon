/**
 * Template HTML para Autorização Exclusiva de Gestão de Venda.
 *
 * Este template representa o modelo oficial exclusivo. A autorização não exclusiva
 * deve ser criada em um template separado quando o modelo jurídico for definido.
 */

export const templateContratoCaptacao = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato de Gestão de Venda</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #111827;
      padding-bottom: 22px;
      margin-bottom: 28px;
    }

    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 8px;
    }

    .titulo {
      font-size: 21px;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 1.8px;
      font-weight: 800;
    }

    .subtitulo {
      color: #6b7280;
      font-size: 13px;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .secao {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .secao-titulo {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #d1d5db;
      letter-spacing: .6px;
    }

    .campo {
      display: flex;
      gap: 12px;
      margin-bottom: 7px;
    }

    .campo-label {
      font-weight: 700;
      width: 150px;
      color: #4b5563;
      flex-shrink: 0;
    }

    .campo-valor {
      flex: 1;
      color: #111827;
    }

    .destaque {
      background-color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #111827;
      margin: 20px 0 26px;
      page-break-inside: avoid;
    }

    .destaque-titulo {
      font-weight: 800;
      color: #111827;
      margin-bottom: 8px;
      text-transform: uppercase;
      font-size: 13px;
      letter-spacing: .5px;
    }

    .clausulas {
      background-color: #f9fafb;
      padding: 22px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }

    .clausula {
      margin-bottom: 15px;
      text-align: justify;
    }

    .clausula:last-child {
      margin-bottom: 0;
    }

    .clausula-numero {
      font-weight: 800;
      color: #111827;
      margin-right: 4px;
    }

    .assinaturas {
      margin-top: 42px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      page-break-inside: avoid;
    }

    .linha-assinatura {
      border-top: 1px solid #111827;
      padding-top: 8px;
      text-align: center;
      font-size: 12px;
      color: #374151;
    }

    .assinatura-box {
      margin-top: 34px;
      padding: 18px;
      border: 2px dashed #9ca3af;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
    }

    .assinatura-box.aceito {
      border-color: #059669;
      background-color: #ecfdf5;
    }

    .qrcode {
      margin: 18px auto;
      text-align: center;
    }

    .qrcode img {
      width: 120px;
      height: 120px;
    }

    .footer {
      margin-top: 34px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 18px;
    }

    .hash {
      font-family: monospace;
      font-size: 10px;
      color: #6b7280;
      word-break: break-all;
      margin-top: 6px;
    }

    @media print {
      body {
        padding: 22px;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    {{#if logoImobiliaria}}
      <img src="{{logoImobiliaria}}" alt="Logo" style="max-height: 80px; margin-bottom: 15px;">
    {{/if}}
    <div class="logo">{{nomeAutorizado}}</div>
    <div class="titulo">Contrato de Gestão de Venda</div>
    <div class="subtitulo">Para fins imobiliários</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Autorizante</div>
    <div class="campo">
      <span class="campo-label">Nome:</span>
      <span class="campo-valor">{{nomeAutorizante}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">CPF/CNPJ:</span>
      <span class="campo-valor">{{cpfCnpjAutorizante}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">{{enderecoAutorizante}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Complemento:</span>
      <span class="campo-valor">{{complementoAutorizante}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">E-mail:</span>
      <span class="campo-valor">{{emailAutorizante}}</span>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Autorizado</div>
    <div class="campo">
      <span class="campo-label">Nome:</span>
      <span class="campo-valor">{{nomeAutorizado}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">CPF/CNPJ:</span>
      <span class="campo-valor">{{cpfCnpjAutorizado}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">CRECI:</span>
      <span class="campo-valor">{{creciAutorizado}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">E-mail:</span>
      <span class="campo-valor">{{emailAutorizado}}</span>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Imóvel</div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">{{enderecoImovel}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Complemento:</span>
      <span class="campo-valor">{{complementoImovel}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">IPTU:</span>
      <span class="campo-valor">{{iptu}}</span>
    </div>
  </div>

  <div class="destaque">
    <div class="destaque-titulo">Condições da autorização exclusiva</div>
    <div class="campo">
      <span class="campo-label">Valor anunciado:</span>
      <span class="campo-valor"><strong>{{valorImovel}}</strong></span>
    </div>
    <div class="campo">
      <span class="campo-label">Comissão:</span>
      <span class="campo-valor"><strong>{{comissao}}</strong></span>
    </div>
    <div class="campo">
      <span class="campo-label">Prazo:</span>
      <span class="campo-valor"><strong>{{prazoAutorizacao}} dias</strong></span>
    </div>
  </div>

  <div class="clausulas">
    <div class="secao-titulo">Cláusulas e condições</div>

    <div class="clausula">
      <span class="clausula-numero">1.</span> O imóvel deverá ser anunciado pelo valor de <strong>{{valorImovel}}</strong>, sendo que a forma de pagamento será objeto de negociação entre as partes.
    </div>

    <div class="clausula">
      <span class="clausula-numero">1.1.</span> O AUTORIZANTE aceita receber propostas em valores inferiores ao mencionado no item 1, mas não está obrigado a aceitá-las.
    </div>

    <div class="clausula">
      <span class="clausula-numero">2.</span> O AUTORIZADO poderá proceder com a divulgação do imóvel acima descrito pelos meios de comunicação que entender necessários, bem como anunciar na plataforma ELYON, possibilitando que seus PARCEIROS divulguem o imóvel em seus respectivos sites e/ou portais, por suas próprias expensas, não tendo o AUTORIZANTE qualquer obrigação de remunerar outros profissionais ou aumentar o valor da comissão em decorrência da atuação de mais corretores.
    </div>

    <div class="clausula">
      <span class="clausula-numero">3.</span> Caso a venda seja efetivada no prazo deste contrato ou, após tal período, com a intermediação do AUTORIZADO, este fará jus, a título de comissão, ao valor correspondente a <strong>{{comissao}}</strong> do preço da negociação do imóvel.
    </div>

    <div class="clausula">
      <span class="clausula-numero">4.</span> Durante a vigência deste contrato, o AUTORIZADO será o responsável exclusivo pela gestão e condução do processo de venda do imóvel, ficando estabelecido que todos os corretores interessados deverão ser direcionados ao AUTORIZADO.
    </div>

    <div class="clausula">
      <span class="clausula-numero">5.</span> O AUTORIZANTE se compromete a não negociar diretamente, nem por intermédio de outro corretor, com quaisquer interessados que tenham sido apresentados pelo AUTORIZADO. Após o término da vigência contratual, tal compromisso permanecerá válido apenas em relação aos interessados devidamente comunicados e identificados pelo AUTORIZADO ao AUTORIZANTE.
    </div>

    <div class="clausula">
      <span class="clausula-numero">5.1.</span> Na hipótese de descumprimento do disposto nesta cláusula, o AUTORIZANTE ficará obrigado a pagar ao AUTORIZADO a comissão integral prevista no item 3.
    </div>

    <div class="clausula">
      <span class="clausula-numero">6.</span> Esta autorização é concedida por prazo de <strong>{{prazoAutorizacao}} dias</strong>, podendo ser revogada mediante aviso expresso de 30 dias de antecedência pelo AUTORIZANTE.
    </div>

    <div class="clausula">
      <span class="clausula-numero">7.</span> Todas as questões eventualmente oriundas do presente contrato serão resolvidas de forma definitiva via conciliatória ou arbitral, na SEGUNDA CORTE DE CONCILIAÇÃO E ARBITRAGEM DE GOIÂNIA-GO (2ª CCA-GO), situada na Avenida Fued José Sebba, Quadra 22, Lotes 22/24, Jardim Goiás, Goiânia-GO, CEP 74.805-100, com renúncia de qualquer outro foro, por mais privilegiado que seja.
    </div>
  </div>

  <div class="assinaturas">
    <div class="linha-assinatura">
      {{nomeAutorizante}}<br>
      AUTORIZANTE
    </div>
    <div class="linha-assinatura">
      {{nomeAutorizado}}<br>
      AUTORIZADO
    </div>
  </div>

  <div class="assinatura-box {{statusAceite}}">
    {{#if aceito}}
    <div style="color: #059669; font-size: 18px; font-weight: bold;">
      AUTORIZAÇÃO ACEITA DIGITALMENTE
    </div>
    <div style="margin-top: 10px; color: #6b7280;">
      Aceita em: {{dataAceite}}<br>
      IP: {{ipAceite}}
    </div>
    {{/if}}
    {{#if aguardandoAceite}}
    <div style="color: #6b7280;">
      Aguardando aceite digital do proprietário
    </div>
    <div class="qrcode no-print">
      <img src="{{qrcodeUrl}}" alt="QR Code para aceite" />
      <div style="margin-top: 10px; font-size: 12px;">
        Escaneie para aceitar ou acesse:<br>
        <a href="{{linkAceite}}">{{linkAceite}}</a>
      </div>
    </div>
    {{/if}}
  </div>

  <div class="footer">
    <p>Documento gerado em {{dataContrato}}</p>
    <p class="hash">Hash de verificação: {{hashContrato}}</p>
    <p style="margin-top: 10px;">
      Este documento possui validade jurídica conforme Lei 14.063/2020 (Assinatura Eletrônica).
    </p>
  </div>
</body>
</html>
`;

export default templateContratoCaptacao;
