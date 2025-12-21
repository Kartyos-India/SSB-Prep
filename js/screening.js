<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screening Tests - SSB Prep</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>

    <!-- Header will be injected by main.js -->
    <header id="header-bar" class="app-header app-container"></header>

    <main id="page-content" class="app-container">
        <!-- Screening.js will dynamically render content here (OIR or PPDT selection) -->
        <div class="loader-container">
            <div class="loader"></div>
            <p>Loading Screening Module...</p>
        </div>
    </main>

    <footer class="app-footer">
        <div class="app-container">
            <p>© 2025 SSB Prep Platform. All rights reserved.</p>
        </div>
    </footer>

    <!-- Main Application Logic -->
    <script type="module" src="js/main.js"></script>
    <script type="module" src="js/screening.js"></script>
</body>
</html>
