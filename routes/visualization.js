const express = require('express');
const router = express.Router();
const pool = require('../msqldb'); 


require('dotenv').config();

// Authentication middleware
const authenticateSecurityHead = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 1) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }
    next();
};


// 1. Incident Types Route
router.get('/incident-types', authenticateSecurityHead, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT type_of_incident 
            FROM incidents 
            WHERE type_of_incident IS NOT NULL 
            ORDER BY type_of_incident
        `);
        
        const types = rows.map(row => row.type_of_incident);
        res.json(types);
    } catch (error) {
        console.error('Error fetching incident types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Visualization endpoint for incident types
router.get('/incidents', authenticateSecurityHead, async (req, res) => {
    try {
        const { startDate, endDate, chartType = 'pie' } = req.query;

        // Validate chartType
        if (!['bar', 'pie'].includes(chartType)) {
            console.warn('❌ Invalid chart type requested:', chartType);
            return res.status(400).json({ error: 'Invalid chartType. Use "bar" or "pie".' });
        }

        // Validate dates
        if (!startDate || !endDate) {
            console.warn('❌ Missing date parameters');
            return res.status(400).json({ error: 'Both startDate and endDate are required.' });
        }

        // Format dates for database query
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        
        console.log('📅 Using date range:', formattedStartDate, 'to', formattedEndDate);

        // Modified query to handle BigInt and date range
        const query = `
            SELECT 
                COALESCE(type_of_incident, 'Unknown') as type_of_incident, 
                CAST(COUNT(*) AS DECIMAL(10,0)) as count 
            FROM incidents 
            WHERE DATE(date) >= ? AND DATE(date) <= ?
                AND type_of_incident IS NOT NULL 
                AND type_of_incident != ''
            GROUP BY type_of_incident 
            ORDER BY count DESC
        `;

        console.log('🔍 Executing query with params:', [formattedStartDate, formattedEndDate]);
        const [results] = await pool.query(query, [formattedStartDate, formattedEndDate]);
        
        if (!results || results.length === 0) {
            console.log('⚠️ No incident data found for the period');
            return res.json({
                labels: [],
                datasets: [{
                    label: 'No Data Available',
                    data: [],
                    backgroundColor: []
                }]
            });
        }

        console.log('📊 Found', results.length, 'incident types');

        // Process results to ensure numbers
        const processedResults = results.map(item => ({
            type_of_incident: item.type_of_incident,
            count: Number(item.count)
        }));

        // Color palette for charts - using the pink/red colors from the image
        const colors = [
            '#FF6384', '#FF6384', '#FF6384', '#36A2EB', '#9966FF',
            '#FF9F40', '#8AC054', '#FF5A5E', '#5891C8', '#FFB400'
        ];

        const labels = processedResults.map(item => item.type_of_incident);
        const data = processedResults.map(item => item.count);
        
        // Format response based on chart type
        let response;
        
        if (chartType === 'bar') {
            response = {
                labels: labels,
                datasets: [{
                    label: 'Number of Incidents',
                    data: data,
                    backgroundColor: colors.slice(0, processedResults.length),
                    borderColor: colors.slice(0, processedResults.length),
                    borderWidth: 1
                }]
            };
        } else {
            // Pie chart specific format
            response = {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, processedResults.length),
                    borderColor: Array(processedResults.length).fill('white'),
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            };
        }

        console.log('✅ Sending response:', JSON.stringify(response, null, 2));
        return res.json(response);

    } catch (error) {
        console.error('❌ Error in /visualization/incidents:', error);
        console.error('Stack trace:', error.stack);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// 3. Monthly Data Route
router.get('/monthly', authenticateSecurityHead, async (req, res) => {
    try {
        const { incidentType } = req.query;
        
        if (!incidentType) {
            return res.status(400).json({ error: 'Incident type is required' });
        }

        const query = `
            SELECT 
                MONTH(date) as month,
                COUNT(*) as count 
            FROM incidents 
            WHERE type_of_incident = ? 
            GROUP BY MONTH(date)
            ORDER BY month ASC
        `;

        const [results] = await pool.query(query, [incidentType]);
        
        // Create array with 12 months
        const monthlyData = Array(12).fill(0);
        
        // Fill in the actual data
        results.forEach(row => {
            if (row.month >= 1 && row.month <= 12) {
                monthlyData[row.month - 1] = Number(row.count);
            }
        });

        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        res.json({
            labels: monthLabels,
            data: { [incidentType]: monthlyData }
        });
    } catch (error) {
        console.error('Error in monthly route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/thresholds', async (req, res) => {
    try {
        // First, verify the tables exist
        const verifyTablesQuery = `
            SELECT 
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents') as incidents_exists,
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'add_incidents') as add_incidents_exists
        `;
        
        const [tableCheck] = await pool.query(verifyTablesQuery);
        
        // Modified queries to handle BigInt conversion
        const incidentCountQuery = `
            SELECT 
                type_of_incident, 
                CAST(COUNT(*) AS DECIMAL(10,0)) as currentCount 
            FROM incidents 
            WHERE type_of_incident IS NOT NULL 
            GROUP BY type_of_incident
        `;

        const thresholdQuery = `
            SELECT 
                incidentName,
                CAST(thresholdValue AS DECIMAL(10,0)) as thresholdValue 
            FROM add_incidents 
            WHERE incidentName IS NOT NULL
        `;

        // Execute queries
        const [incidentResults] = await pool.query(incidentCountQuery);
        const [thresholdResults] = await pool.query(thresholdQuery);

        // Convert BigInt values to regular numbers
        const incidentCounts = incidentResults.map(row => ({
            type_of_incident: row.type_of_incident,
            currentCount: Number(row.currentCount)
        }));

        const thresholds = thresholdResults.map(row => ({
            incidentName: row.incidentName,
            thresholdValue: Number(row.thresholdValue)
        }));

        // Process the data
        const thresholdData = incidentCounts.map(incident => ({
            incidentName: incident.type_of_incident,
            currentCount: incident.currentCount,
            thresholdValue: thresholds.find(t => t.incidentName === incident.type_of_incident)?.thresholdValue || 100
        }));

        // Add missing thresholds
        thresholds.forEach(threshold => {
            if (!thresholdData.some(item => item.incidentName === threshold.incidentName)) {
                thresholdData.push({
                    incidentName: threshold.incidentName,
                    currentCount: 0,
                    thresholdValue: threshold.thresholdValue
                });
            }
        });

        res.json(thresholdData);

    } catch (error) {
        console.error('Error fetching threshold data:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// API route to get monthly incident data
router.get('/visualization/monthly', authenticateSecurityHead, async (req, res) => {
    try {
        console.log('=== START: Fetching monthly data ===');
        console.log('Request query parameters:', req.query);
        const incidentType = req.query.incidentType;

        if (!incidentType) {
            console.warn('❌ Incident type is missing in request');
            return res.status(400).json({ error: 'Incident type is required.' });
        }

        const query = `
            SELECT MONTH(date) as month, COUNT(*) as count 
            FROM incidents 
            WHERE type_of_incident = ? 
            GROUP BY MONTH(date)
            ORDER BY month ASC
        `;

        console.log('Executing query with incident type:', incidentType);
        const [results] = await pool.query(query, [incidentType]);
        console.log('Database results:', JSON.stringify(results, null, 2));

        const monthlyData = Array(12).fill(0);
        console.log('Initial monthly data array:', monthlyData);

        results.forEach(item => {
            console.log(`Processing month ${item.month} with count ${item.count}`);
            if (item.month >= 1 && item.month <= 12) {
                monthlyData[item.month - 1] = item.count;
            }
        });

        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const response = { 
            labels: monthLabels, 
            data: { [incidentType]: monthlyData } 
        };

        console.log('=== Final response payload ===');
        console.log(JSON.stringify(response, null, 2));
        console.log('=== END: Sending response ===');

        res.json(response);

    } catch (error) {
        console.error('❌ Error in /visualization/monthly:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Main visualization page route


router.get('/visualize', authenticateSecurityHead, async (req, res) => {
    const { name } = req.session.user;

    try {
        // Get all available incident types for the dropdown
        const [incidentTypes] = await pool.query(`
            SELECT DISTINCT type_of_incident 
            FROM incidents 
            ORDER BY type_of_incident ASC
        `);

        const defaultType = incidentTypes.length > 0 ? incidentTypes[0].type_of_incident : null;

        res.render('sh-visualize', { 
            name,
            defaultIncidentType: defaultType
        });
    } catch (error) {
        console.error('Error loading visualization page:', error);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
