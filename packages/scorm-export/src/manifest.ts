function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildImsManifest(input: {
  title: string;
  scoIdentifier: string;
  masteryScore: number;
  entryHref: string;
  fileHrefs: string[];
}): string {
  const { title, scoIdentifier, masteryScore, entryHref, fileHrefs } = input;
  const orgId = `${scoIdentifier}_ORG`;
  const resourceId = `${scoIdentifier}_RES`;
  const fileTags = fileHrefs
    .map((href) => `      <file href="${escapeXml(href)}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="${escapeXml(scoIdentifier)}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${escapeXml(orgId)}">
    <organization identifier="${escapeXml(orgId)}">
      <title>${escapeXml(title)}</title>
      <item identifier="${escapeXml(scoIdentifier)}_ITEM" isvisible="true" identifierref="${escapeXml(resourceId)}">
        <title>${escapeXml(title)}</title>
        <adlcp:masteryscore>${masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${escapeXml(resourceId)}" type="webcontent" href="${escapeXml(entryHref)}" adlcp:scormtype="sco">
${fileTags}
    </resource>
  </resources>
</manifest>
`;
}
