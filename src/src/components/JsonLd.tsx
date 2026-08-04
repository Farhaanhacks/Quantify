// Renders one or more JSON-LD structured-data blocks. The payload is our own
// data (schema.org objects), so dangerouslySetInnerHTML here is the standard,
// safe pattern for structured data.
export default function JsonLd({ data }: { data: object | object[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}
