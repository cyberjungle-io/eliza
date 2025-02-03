import type { Plugin, Action, IAgentRuntime, Memory, State, HandlerCallback, Content } from './types';
import pkg from 'pg';
const { Pool } = pkg;

// Create a connection pool
const pool = new Pool({
  host: process.env.HYDRATION_DB_HOST,
  port: parseInt(process.env.HYDRATION_DB_PORT || '5432'),
  database: process.env.HYDRATION_DB_NAME,
  user: process.env.HYDRATION_DB_USER,
  password: process.env.HYDRATION_DB_PASSWORD
});

// Create simplified test actions
const executeQuery: Action = {
  name: 'EXECUTE_QUERY',
  description: 'Execute a SQL query against the Hydration database',
  similes: ['executeQuery', 'EXECUTE_QUERY', 'runQuery'],
  examples: [
    [{
      user: 'hydration-db',
      content: {
        text: 'SELECT * FROM table_name',
        action: 'EXECUTE_QUERY'
      } as Content
    }]
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('[executeQuery] Validating action...');
    console.log('[executeQuery] Message content:', JSON.stringify(message.content, null, 2));
    
    // Allow both direct messages and SQL queries to pass validation
    return true;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback) => {
    console.log('[executeQuery] === Executing query ===');
    console.log('[executeQuery] Raw message:', JSON.stringify(message, null, 2));
    
    try {
      // Check if this is a direct message
      if (message.content.source === 'direct') {
        console.log('[executeQuery] Received direct message - waiting for LLM response');
        return {
          text: 'Processing query...',
          content: {
            status: 'pending',
            message: 'Waiting for query generation'
          }
        };
      }

      // Extract SQL query from the message
      let sqlQuery = message.content.text;
      console.log('[executeQuery] Initial SQL query:', sqlQuery);
      
      // If it's not a SQL query, try to get it from the response
      if (!sqlQuery?.toLowerCase().includes('select')) {
        console.log('[executeQuery] Not a SQL query, checking response content');
        sqlQuery = message.content.response?.content?.text;
      }
      
      console.log('[executeQuery] Found SQL query:', sqlQuery);
      
      if (!sqlQuery || typeof sqlQuery !== 'string' || !sqlQuery.toLowerCase().includes('select')) {
        throw new Error('Invalid or missing SQL query in message');
      }

      // Clean the query string
      const query = sqlQuery.trim();
      console.log('[executeQuery] Cleaned query:', query);
      console.log('[executeQuery] Query type:', typeof query);
      console.log('[executeQuery] Query length:', query.length);

      // Execute the query
      console.log('[executeQuery] Attempting to execute query...');
      console.log('[executeQuery] EXACT QUERY BEING SENT TO POSTGRES:', JSON.stringify(query));
      const result = await pool.query(query);
      console.log('[executeQuery] Query executed successfully');
      console.log('[executeQuery] Result:', JSON.stringify(result, null, 2));
      
      const response = {
        text: JSON.stringify({
          query: query,
          rows: result.rows,
          rowCount: result.rowCount
        }),
        content: { 
          status: 'success',
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields?.map(f => f.name)
        }
      };

      if (callback) {
        await callback(response);
      }

      return response;
    } catch (error) {
      console.error('[executeQuery] Error executing query:', error);
      console.error('[executeQuery] Error stack:', error.stack);
      
      const errorResponse = {
        text: `Error executing query: ${error.message}`,
        content: { 
          status: 'error',
          error: error.message,
          query: message.content.response?.content?.text || 'No query found',
          stack: error.stack
        }
      };

      if (callback) {
        await callback(errorResponse);
      }

      return errorResponse;
    }
  }
};

const testDbConnection: Action = {
  name: 'TEST_DB_CONNECTION',
  description: 'Test the database connection',
  similes: ['testDb', 'TEST_DB', 'testConnection'],
  examples: [
    [{
      user: 'hydration-db',
      content: {
        text: 'test database connection',
        action: 'TEST_DB_CONNECTION'
      } as Content
    }]
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('[testDbConnection] Validating action...');
    return true;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback) => {
    console.log('[testDbConnection] === Testing connection ===');
    
    try {
      // Test the connection with a simple query
      await pool.query('SELECT 1');
      console.log('[testDbConnection] Connection successful');
      
      const response = {
        text: 'Database connection successful',
        content: { status: 'success' }
      };

      if (callback) {
        await callback(response);
      }

      return response;
    } catch (error) {
      console.error('[testDbConnection] Connection error:', error);
      
      const errorResponse = {
        text: 'Database connection failed',
        content: { 
          status: 'error',
          error: error.message
        }
      };

      if (callback) {
        await callback(errorResponse);
      }

      return errorResponse;
    }
  }
};

// Create the plugin instance
console.log('[hydration-db] Creating plugin...');

const plugin: Plugin = {
  name: '@elizaos/plugin-hydration-db',
  description: 'Plugin for interacting with the Hydration database',
  actions: [executeQuery, testDbConnection]
};

console.log('[hydration-db] Plugin created with actions:', plugin.actions.map(a => a.name));

export const hydrationDbPlugin = plugin;
export default plugin; 
