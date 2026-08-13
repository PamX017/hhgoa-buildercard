import { notFound } from 'next/navigation';

/**
 * /g/[id] — Share page with OG meta tags
 *
 * This server-rendered page provides Open Graph tags so Twitter/X
 * unfurls the actual generated Builder ID card image in link previews.
 * Real browsers are redirected to view the image directly.
 */

async function getShareData(id) {
  try {
    const { kv } = await import('@vercel/kv');
    const data = await kv.get(`share:${id}`);
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await getShareData(id);

  if (!data?.blobUrl) {
    return {
      title: 'HH Goa 2026 Builder ID',
      description: 'Create your Builder Pass for Hacker Goa House 2026!',
    };
  }

  return {
    title: 'My HH Goa 2026 Builder ID 🌴',
    description: 'Check out my Builder Pass for Hacker Goa House 2026! #FrameInGoa',
    openGraph: {
      title: 'My HH Goa 2026 Builder ID 🌴',
      description: 'Check out my Builder Pass for Hacker Goa House 2026! #FrameInGoa',
      images: [
        {
          url: data.blobUrl,
          width: 2046,
          height: 3076,
          alt: 'HH Goa 2026 Builder ID Card',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'My HH Goa 2026 Builder ID 🌴',
      description: 'Check out my Builder Pass for Hacker Goa House 2026! #FrameInGoa',
      images: [data.blobUrl],
    },
  };
}

export default async function SharePage({ params }) {
  const { id } = await params;
  const data = await getShareData(id);

  const imageUrl = data?.blobUrl;

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#0A3A1E',
        color: '#F2DAB1',
        fontFamily: "'Roboto Slab', serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
      }}>
        <div style={{ padding: '2rem', maxWidth: '600px' }}>
          <h1 style={{
            fontFamily: "'Bevan', serif",
            fontSize: '2rem',
            color: '#D18907',
            marginBottom: '0.5rem',
          }}>
            Your frame is ready
          </h1>
          <p style={{ color: '#F2DAB1', opacity: 0.7, marginBottom: '2rem' }}>
            Link preview shows this graphic with #FrameInGoa
          </p>

          {imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Builder ID Card"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '16px',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                }}
              />
              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href={imageUrl}
                  download="hh-goa-builder-id.png"
                  style={{
                    background: '#D18907',
                    color: '#0A3A1E',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                  }}
                >
                  ⬇ Download Image
                </a>
                <a
                  href="/"
                  style={{
                    background: 'rgba(242, 218, 177, 0.1)',
                    color: '#F2DAB1',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    border: '1px solid rgba(242, 218, 177, 0.2)',
                  }}
                >
                  Create Your Own
                </a>
              </div>
            </>
          ) : (
            <div style={{ padding: '3rem' }}>
              <p>This card has expired or could not be found.</p>
              <a
                href="/"
                style={{
                  display: 'inline-block',
                  marginTop: '1rem',
                  background: '#D18907',
                  color: '#0A3A1E',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                }}
              >
                Create Your Builder ID →
              </a>
            </div>
          )}
        </div>

        {/* Client-side redirect for real browsers (not bots) */}
        {imageUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  var ua = navigator.userAgent || '';
                  var isBot = /Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|Discordbot|WhatsApp/i.test(ua);
                  if (!isBot) {
                    // Don't redirect — show the nice share page instead
                  }
                })();
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
