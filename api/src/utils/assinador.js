// ============================================================================
// src/utils/assinador.js
// Assinatura digital XMLDSig dos eventos EFD-REINF (série R-4000 + R-1000).
//
// Padrao exigido pelo Manual do Desenvolvedor EFD-REINF (item Assinatura
// Digital): XMLDSig FORMATO ENVELOPED, RSA-SHA256, digest SHA256,
// canonicalizacao C14N, transforms [enveloped-signature, C14N].
// A <Signature> entra dentro de <Reinf>, logo apos o elemento do evento.
// KeyInfo carrega apenas o <X509Certificate> do certificado do assinante.
//
// O certificado usado e o A1 da PROPRIA SP Assessoria (procuradora),
// lido via cert-loader.js. Nada de senha/pfx trafega aqui — so PEM em memoria.
// ============================================================================
const { SignedXml } = require('xml-crypto');

// Algoritmos exigidos pelo SPED/EFD-REINF (NAO usar sha1).
const SIG_ALG    = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';
const C14N       = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED  = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Extrai o atributo id (ID + 34 digitos) do elemento de evento no XML.
 * Funciona para evtInfoContri (R-1000), evtRetPF (R-4010) e evtFech (R-4099).
 */
function extrairIdEvento(xml) {
  const m = xml.match(/<(?:evtInfoContri|evtRetPF|evtFech)\s+id="(ID\d{34})"/);
  if (!m) throw new Error('assinador: atributo id do evento nao encontrado no XML');
  return m[1];
}

/**
 * Assina um XML de evento REINF (string) com o certificado A1.
 *
 * @param {string} xmlEvento  XML do evento gerado pelo reinfUtils (sem Signature)
 * @param {object} cert       { pemKey, pemCert } — saida do cert-loader
 * @returns {string}          XML assinado, com <Signature> dentro de <Reinf>
 */
function assinarEventoReinf(xmlEvento, cert) {
  if (!xmlEvento || typeof xmlEvento !== 'string')
    throw new Error('assinador: xmlEvento ausente ou invalido');
  if (!cert || !cert.pemKey || !cert.pemCert)
    throw new Error('assinador: certificado sem pemKey/pemCert');

  const idEvento = extrairIdEvento(xmlEvento);

  // Remove comentarios (ex.: o placeholder "<!-- ASSINATURA ... -->")
  const xml = xmlEvento.replace(/<!--[\s\S]*?-->/g, '');

  const sig = new SignedXml({
    privateKey: cert.pemKey,
    publicCert: cert.pemCert,
    signatureAlgorithm: SIG_ALG,
    canonicalizationAlgorithm: C14N,
  });

  // Referencia ao evento pelo seu atributo id. URI explicito (#id) — o SPED
  // recusa assinatura com URI vazio.
  sig.addReference({
    xpath: `//*[@id='${idEvento}']`,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: DIGEST_ALG,
    uri: `#${idEvento}`,
  });

  // KeyInfo com apenas o X509Certificate do assinante.
  sig.getKeyInfoContent = function () {
    const b64 = cert.pemCert
      .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    return `<X509Data><X509Certificate>${b64}</X509Certificate></X509Data>`;
  };

  // <Signature> logo apos o elemento do evento, ainda dentro de <Reinf>.
  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name()='evtInfoContri' or local-name()='evtRetPF' or local-name()='evtFech']`,
      action: 'after',
    },
  });

  return sig.getSignedXml();
}

module.exports = { assinarEventoReinf, extrairIdEvento };
