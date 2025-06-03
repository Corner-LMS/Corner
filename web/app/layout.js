import './globals.css'
export const metadata = {
    title: 'Corner Discussion',
    description: 'Real-time discussion platform for students',
    
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
                <link href="https://cdn.jsdelivr.net/npm/mdb-ui-kit@6.4.2/css/mdb.min.css" rel="stylesheet" />

               
                <link rel="apple-touch-icon" href="%PUBLIC_URL%/favicon-96x96.png" />


                <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />



                
            </head>
            <body>
                <div id="root">{children}</div>

                <script src="https://cdn.jsdelivr.net/npm/mdb-ui-kit@6.4.2/js/mdb.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>


            </body>
        </html>
    )
}