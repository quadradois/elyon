/**
 * Template HTML para Contrato de Captação de Imóvel
 * Variáveis disponíveis: {{nomeProprietario}}, {{cpf}}, {{telefone}}, {{email}},
 * {{enderecoImovel}}, {{tipoImovel}}, {{areaImovel}}, {{comissao}}, {{prazoTrabalho}},
 * {{tipoAutorizacao}}, {{dataContrato}}, {{hashContrato}}, {{linkAceite}}
 */

export const templateContratoCaptacao = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato de Autorização de Captação</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .titulo {
      font-size: 20px;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .secao {
      margin-bottom: 25px;
    }
    
    .secao-titulo {
      font-size: 14px;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .campo {
      display: flex;
      margin-bottom: 8px;
    }
    
    .campo-label {
      font-weight: 600;
      width: 180px;
      color: #6b7280;
    }
    
    .campo-valor {
      flex: 1;
      color: #111827;
    }
    
    .clausulas {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .clausula {
      margin-bottom: 15px;
    }
    
    .clausula-numero {
      font-weight: bold;
      color: #2563eb;
    }
    
    .destaque {
      background-color: #dbeafe;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
      margin: 20px 0;
    }
    
    .destaque-titulo {
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .assinatura-box {
      margin-top: 40px;
      padding: 20px;
      border: 2px dashed #9ca3af;
      border-radius: 8px;
      text-align: center;
    }
    
    .assinatura-box.aceito {
      border-color: #10b981;
      background-color: #ecfdf5;
    }
    
    .qrcode {
      margin: 20px auto;
      text-align: center;
    }
    
    .qrcode img {
      width: 120px;
      height: 120px;
    }
    
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    
    .hash {
      font-family: monospace;
      font-size: 10px;
      color: #6b7280;
      word-break: break-all;
    }
    
    @media print {
      body {
        padding: 20px;
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
    <div class="logo">{{nomeImobiliaria}}</div>
    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
      {{#if cnpjImobiliaria}}CNPJ: {{cnpjImobiliaria}}<br>{{/if}}
      {{#if enderecoImobiliaria}}{{enderecoImobiliaria}}<br>{{/if}}
      {{#if siteImobiliaria}}{{siteImobiliaria}} | {{/if}}
      {{#if telefoneImobiliaria}}{{telefoneImobiliaria}}{{/if}}
    </div>
    <div class="titulo">Contrato de Autorização de Captação</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">CONTRATADA (IMOBILIÁRIA)</div>
    <div class="campo">
      <span class="campo-label">Razão Social:</span>
      <span class="campo-valor">{{nomeImobiliaria}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">CNPJ:</span>
      <span class="campo-valor">{{cnpjImobiliaria}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">{{enderecoImobiliaria}}</span>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">CONTRATANTE (PROPRIETÁRIO)</div>
    <div class="campo">
      <span class="campo-label">Nome Completo:</span>
      <span class="campo-valor">{{nomeProprietario}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">CPF:</span>
      <span class="campo-valor">{{cpf}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Telefone:</span>
      <span class="campo-valor">{{telefone}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">E-mail:</span>
      <span class="campo-valor">{{email}}</span>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Dados do Imóvel</div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">{{enderecoImovel}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Tipo:</span>
      <span class="campo-valor">{{tipoImovel}}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Área:</span>
      <span class="campo-valor">{{areaImovel}} m²</span>
    </div>
  </div>

  <div class="destaque">
    <div class="destaque-titulo">Condições Comerciais</div>
    <div class="campo">
      <span class="campo-label">Tipo de Autorização:</span>
      <span class="campo-valor"><strong>{{tipoAutorizacaoTexto}}</strong></span>
    </div>
    <div class="campo">
      <span class="campo-label">Comissão:</span>
      <span class="campo-valor"><strong>{{comissao}}</strong></span>
    </div>
    <div class="campo">
      <span class="campo-label">Prazo de Trabalho:</span>
      <span class="campo-valor"><strong>{{prazoTrabalho}} dias</strong></span>
    </div>
  </div>

  <div class="clausulas">
    <div class="secao-titulo">Cláusulas e Condições</div>
    
    <div class="clausula">
      <span class="clausula-numero">1.</span> O PROPRIETÁRIO autoriza a IMOBILIÁRIA a promover a venda/locação do imóvel descrito acima, podendo divulgá-lo em portais imobiliários, redes sociais e demais canais de comercialização.
    </div>
    
    <div class="clausula">
      <span class="clausula-numero">2.</span> A comissão acordada será devida à IMOBILIÁRIA quando da efetiva conclusão do negócio, sendo calculada sobre o valor total da transação.
    </div>
    
    <div class="clausula">
      <span class="clausula-numero">3.</span> {{clausulaExclusividade}}
    </div>
    
    <div class="clausula">
      <span class="clausula-numero">4.</span> O prazo de vigência desta autorização é de {{prazoTrabalho}} dias, renovável automaticamente por igual período, salvo manifestação em contrário de qualquer das partes com 10 dias de antecedência.
    </div>
    
    <div class="clausula">
      <span class="clausula-numero">5.</span> O PROPRIETÁRIO declara ser o legítimo proprietário ou possuir poderes para autorizar a comercialização do imóvel.
    </div>
  </div>

  <div class="assinatura-box {{statusAceite}}">
    {{#if aceito}}
    <div style="color: #10b981; font-size: 18px; font-weight: bold;">
      ✓ CONTRATO ACEITO DIGITALMENTE
    </div>
    <div style="margin-top: 10px; color: #6b7280;">
      Aceito em: {{dataAceite}}<br>
      IP: {{ipAceite}}
    </div>
    {{else}}
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
      Este documento possui validade jurídica conforme Lei 14.063/2020 (Assinatura Eletrônica)
    </p>
  </div>
</body>
</html>
`;

export default templateContratoCaptacao;
