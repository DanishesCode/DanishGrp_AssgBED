const BASE_URL = "http://localhost:3000";

// Get user ID from localStorage (set during login)
function getUserID() {
  const currentUser = localStorage.getItem('currentUser');
  console.log('Raw currentUser from localStorage:', currentUser);
  
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      console.log('Parsed user object:', user);
      // Try different possible property names for userID
      const userId = user.userId || user.id || user.user_id || user.UserID ;
      console.log('Using UserID:', userId);
      console.log('UserID type:', typeof userId);
      return userId;
    } catch (e) {
      console.error('Error parsing user data:', e);
      console.log('Fallback to UserID: 1');
      return 1;
    }
  }
  console.log('No currentUser, fallback to UserID: 1');
  return 1; // Default fallback
}

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

const UserID = getUserID();

let groceryItems = [];
let nextId = 1;
let allMeals = [];
let mealPlan = [];

// Load initial data
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication first
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please log in to access this page');
        window.location.href = '../login/login.html';
        return;
    }
    
    await loadGroceryItems();
    await loadMeals();
    await loadMealPlan();
    updateGroceryTable();
});

// Load grocery items from database
async function loadGroceryItems() {
    try {
        const response = await fetch(`${BASE_URL}/grocery/user/${UserID}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const items = await response.json();
        console.log('Loaded grocery items:', items);
        
        // Check if items is an array before mapping
        if (Array.isArray(items)) {
            groceryItems = items.map(item => ({
                id: item.item_id,
                name: item.item_name,
                quantity: item.quantity,
                unit: item.unit || 'pcs',
                status: item.bought ? 'bought' : 'pending',
                price: item.price || 0,
                notes: item.notes || ''
            }));
        } else {
            console.error('Expected array but got:', typeof items);
            groceryItems = [];
        }
    } catch (error) {
        console.error('Error loading grocery items:', error);
        groceryItems = [];
    }
}

// Load meals from database
async function loadMeals() {
    try {
        const response = await fetch(`${BASE_URL}/meals/${UserID}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allMeals = await response.json();
        console.log('Loaded meals:', allMeals);
    } catch (error) {
        console.error('Error loading meals:', error);
        allMeals = [];
    }
}

// Load meal plan from database
async function loadMealPlan() {
    try {
        const response = await fetch(`${BASE_URL}/mealplans/${UserID}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        mealPlan = await response.json();
        console.log('Loaded meal plan:', mealPlan);
    } catch (error) {
        console.error('Error loading meal plan:', error);
        mealPlan = [];
    }
}

async function generateGroceryList() {
    const breakfast = document.getElementById('breakfast').checked;
    const lunch = document.getElementById('lunch').checked;
    const dinner = document.getElementById('dinner').checked;

    // Get meals from the actual meal plan based on selected categories
    const selectedMeals = [];
    
    console.log('Current meal plan:', mealPlan);
    
    if (breakfast) {
        const breakfastMeals = mealPlan.filter(plan => 
            plan.MealTime.toLowerCase() === 'breakfast'
        );
        console.log('Breakfast meals found:', breakfastMeals);
        breakfastMeals.forEach(meal => {
            selectedMeals.push({
                mealId: meal.MealID,
                category: meal.Category || 'breakfast',
                name: meal.MealName,
                servings: 4 // Default servings
            });
        });
    }
    
    if (lunch) {
        const lunchMeals = mealPlan.filter(plan => 
            plan.MealTime.toLowerCase() === 'lunch'
        );
        console.log('Lunch meals found:', lunchMeals);
        lunchMeals.forEach(meal => {
            selectedMeals.push({
                mealId: meal.MealID,
                category: meal.Category || 'lunch',
                name: meal.MealName,
                servings: 4
            });
        });
    }
    
    if (dinner) {
        const dinnerMeals = mealPlan.filter(plan => 
            plan.MealTime.toLowerCase() === 'dinner'
        );
        console.log('Dinner meals found:', dinnerMeals);
        dinnerMeals.forEach(meal => {
            selectedMeals.push({
                mealId: meal.MealID,
                category: meal.Category || 'dinner',
                name: meal.MealName,
                servings: 4
            });
        });
    }

    console.log('Selected meals for grocery generation:', selectedMeals);

    if (selectedMeals.length === 0) {
        alert('No meals found in your meal plan for the selected categories. Please add some meals to your meal plan first.');
        return;
    }

    try {
        // Call backend API to generate grocery list
        console.log('Calling grocery generation API with:', selectedMeals);
        const response = await fetch(`${BASE_URL}/grocery/generate/${UserID}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                selectedMeals: selectedMeals
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            throw new Error('Failed to generate grocery list');
        }

        const result = await response.json();
        console.log('Grocery generation result:', result);
        
        if (result.success) {
            const itemCount = result.items ? result.items.length : 0;
            const addedCount = result.details ? result.details.addedItems : itemCount;
            
            if (itemCount === 0) {
                alert('No ingredients found for the selected meals. This might mean:\n- The meals don\'t have Spoonacular ingredient data\n- The meals are using fallback category ingredients\n- There was an issue processing the meals');
            } else {
                alert(`Successfully added ${addedCount} ingredients to your grocery list!`);
            }
            
            // Reload the grocery items
            await loadGroceryItems();
            updateGroceryTable();
        } else {
            alert('Failed to generate grocery list: ' + result.message);
        }
    } catch (error) {
        console.error('Error generating grocery list:', error);
        alert('Error generating grocery list. Please try again.');
    }
}

async function addItem() {
    const nameInput = document.getElementById('newItemInput');
    const quantityInput = document.getElementById('newItemQuantity');
    
    const name = nameInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 1;

    if (name) {
        try {
            const response = await fetch(`${BASE_URL}/grocery`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    item_name: name,
                    quantity: quantity,
                    unit: 'pcs',
                    bought: false,
                    user_id: UserID,
                    price: 0.00,
                    notes: 'Added manually'
                })
            });

            if (response.ok) {
                nameInput.value = '';
                quantityInput.value = '1';
                await loadGroceryItems();
                updateGroceryTable();
            } else {
                alert('Failed to add item');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Error adding item. Please try again.');
        }
    }
}

// Test function to add sample grocery items
async function addTestItems() {
    const testItems = [
        { name: 'Milk', quantity: 1, unit: 'liter' },
        { name: 'Bread', quantity: 2, unit: 'loaves' },
        { name: 'Eggs', quantity: 12, unit: 'pieces' },
        { name: 'Apples', quantity: 6, unit: 'pieces' },
        { name: 'Chicken breast', quantity: 500, unit: 'grams' }
    ];

    for (const item of testItems) {
        try {
            await fetch(`${BASE_URL}/grocery`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    item_name: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    bought: false,
                    user_id: UserID,
                    price: 0.00,
                    notes: 'Test item'
                })
            });
        } catch (error) {
            console.error('Error adding test item:', error);
        }
    }
    
    await loadGroceryItems();
    updateGroceryTable();
    alert('Test grocery items added!');
}

// Debug function to check meal data
async function debugMealData() {
    console.log('=== DEBUGGING MEAL DATA ===');
    console.log('All meals:', allMeals);
    console.log('Meal plan:', mealPlan);
    
    if (allMeals.length > 0) {
        console.log('Sample meal details:');
        for (let i = 0; i < Math.min(3, allMeals.length); i++) {
            const meal = allMeals[i];
            console.log(`Meal ${i + 1}:`, {
                MealID: meal.MealID,
                MealName: meal.MealName,
                Category: meal.Category,
                SpoonacularID: meal.SpoonacularID,
                Ingredients: meal.Ingredients,
                hasIngredients: !!meal.Ingredients
            });
        }
    }
    
    if (mealPlan.length > 0) {
        console.log('Meal plan entries:');
        mealPlan.forEach((plan, index) => {
            console.log(`Plan ${index + 1}:`, {
                MealID: plan.MealID,
                MealName: plan.MealName,
                MealTime: plan.MealTime,
                DayOfWeek: plan.DayOfWeek
            });
        });
    } else {
        console.log('No meal plan entries found!');
    }
    
    alert('Check the console for meal debugging information');
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        addItem();
    }
}

async function toggleItemStatus(id) {
    const item = groceryItems.find(item => item.id === id);
    if (item) {
        const newStatus = item.status === 'pending' ? true : false;
        
        try {
            // Find the database item ID (you might need to store this differently)
            const dbItem = await fetch(`${BASE_URL}/grocery/user/${UserID}`, {
                headers: getAuthHeaders()
            }).then(res => res.json());
            const dbItemData = dbItem.find(dbI => dbI.item_name === item.name);
            
            if (dbItemData) {
                const response = await fetch(`${BASE_URL}/grocery/item/${dbItemData.item_id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        item_name: item.name,
                        quantity: item.quantity,
                        bought: newStatus,
                        price: item.price || 0,
                        notes: item.notes || ''
                    })
                });

                if (response.ok) {
                    item.status = newStatus ? 'bought' : 'pending';
                    updateGroceryTable();
                }
            }
        } catch (error) {
            console.error('Error updating item status:', error);
        }
    }
}

async function deleteItem(id) {
    const item = groceryItems.find(item => item.id === id);
    if (item && confirm('Are you sure you want to delete this item?')) {
        try {
            // Find the database item ID
            const dbItem = await fetch(`${BASE_URL}/grocery/user/${UserID}`, {
                headers: getAuthHeaders()
            }).then(res => res.json());
            const dbItemData = dbItem.find(dbI => dbI.item_name === item.name);
            
            if (dbItemData) {
                const response = await fetch(`${BASE_URL}/grocery/item/${dbItemData.item_id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                if (response.ok) {
                    await loadGroceryItems();
                    updateGroceryTable();
                }
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    }
}

async function clearBoughtItems() {
    if (confirm('Are you sure you want to clear all bought items?')) {
        const boughtItems = groceryItems.filter(item => item.status === 'bought');
        
        for (const item of boughtItems) {
            try {
                const dbItem = await fetch(`${BASE_URL}/grocery/user/${UserID}`, {
                    headers: getAuthHeaders()
                }).then(res => res.json());
                const dbItemData = dbItem.find(dbI => dbI.item_name === item.name);
                
                if (dbItemData) {
                    await fetch(`${BASE_URL}/grocery/item/${dbItemData.item_id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                }
            } catch (error) {
                console.error('Error deleting bought item:', error);
            }
        }
        
        await loadGroceryItems();
        updateGroceryTable();
    }
}

function updateGroceryTable() {
    const tableBody = document.getElementById('groceryTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (groceryItems.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    tableBody.innerHTML = groceryItems.map(item => `
        <tr class="${item.status === 'bought' ? 'bought' : ''}">
            <td>${item.name}</td>
            <td>${item.quantity} ${item.unit}</td>
            <td>
                <span class="status-badge status-${item.status}">
                    ${item.status === 'pending' ? '⏳ Pending' : '✅ Bought'}
                </span>
            </td>
            <td>
                <input type="checkbox" class="status-checkbox" 
                       ${item.status === 'bought' ? 'checked' : ''} 
                       onchange="toggleItemStatus(${item.id})">
            </td>
            <td>
                <button class="delete-btn" onclick="deleteItem(${item.id})">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}