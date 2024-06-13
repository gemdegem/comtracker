# ComTracker v1

ComTracker is a web application designed to uncover connections between Ethereum addresses. In its initial version (v1), users can input two Ethereum addresses to identify all transactions between them, including intermediate addresses ( in the application marked as depth 2). The application provides detailed information about the transaction time, the amount of cryptocurrency, and the type of cryptocurrency sent.

Additionally, ComTracker offers a user-friendly interface for visualizing these connections, making it easier to understand the flow of funds and the relationships between different addresses. Built with Next.js, and Tailwind CSS, ReactFlow.

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (version 14 or higher)
- npm (version 6 or higher) or yarn or pnpm or bun
- A text editor like VS Code

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/gemdegem/comtracker.git
   cd comtracker
   ```

2. **Install Dependencies:**

   Depending on your package manager, run one of the following commands:

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Environment Variables:**
   The project uses environment variables for configuration. Create a .env.local file in the root directory and add the necessary variables:
   V1 bitquery api key. https://account.bitquery.io/user/api_v1/api_keys

   ```bash
   BITQUERY_API_KEY=your_api_key_here
   ```

### Running the Development Server

To start the development server, use one of the following commands:

    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    # or
    bun dev
    ```

Open http://localhost:3000 with your browser to see the application.
