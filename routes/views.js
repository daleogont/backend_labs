const express = require('express');
const {v4: uuidv4} = require('uuid');
const {sequelize} = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const {User} = require('../models/index');
const {Category} = require('../models/index');
const {Record} = require('../models/index');
const {Wallet} = require('../models/index');


const { userPostSchema,  userGetSchema} = require('../schemas/user_schema');
const { categoryPostSchema, categoryGetSchema } = require('../schemas/category_schema');
const recordSchema = require('../schemas/record_shema');
const { walletPostSchema, walletGetSchema, walletRaiseSchema } = require('../schemas/wallet_schema');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, 'jwt_very_secret_key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user; 
    next(); 
  });
};

router.post('/signup', async (req, res) => {
  const { user_name, password } = req.body;

  try {
    const existingUser = await User.findOne({ where: { user_name } });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({ user_name, password: hashedPassword });

    res.status(201).json({ message: "User created", userId: newUser.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Malfunction' });
  }
});

router.post('/login', async (req, res) => {
  const { user_name, password } = req.body;

  try {
    const user = await User.findOne({ where: { user_name } });
    if (!user) {
      return res.status(401).json({ message: "User does not exist" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = jwt.sign({ userId: user.id }, 'jwt_very_secret_key', { expiresIn: '1h' });

    res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const decodeToken = (token) => {
  try {
    return jwt.verify(token, 'jwt_very_secret_key');
  } catch (error) {
    return null;
  }
};

router.get('/users',authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll();

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server Malfunction' });
  }
});


router.get('/user/:user_id',authenticateToken, async (req, res) => {
  const uId = req.params.user_id;

  const validationResult = userGetSchema.validate({ uId });

      if (validationResult.error) {
          return res.status(400).json({ message: validationResult.error.details[0].message });
      }


  try {
      const curUser = await User.findByPk(uId);

      if (!curUser) {
          return res.status(404).json({ message: 'invalid user_id' });
      }

      res.status(200).json(curUser);
  } catch (error) {
      console.error(`Error fetching user with user_id ${uId}:`, error);
      res.status(500).json({ message: 'Server Malfunction' });
  }
});

router.delete('/user', authenticateToken,async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const decodedToken = decodeToken(token);

  if (!decodedToken || !decodedToken.userId) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const user = await User.findByPk(decodedToken.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.destroy();
    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Malfunction' });
  }
});

router.post('/category', authenticateToken,async (req, res) => {
  try {
    const { cat_name } = req.body;

    const validationResult = categoryPostSchema.validate({ cat_name });  

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
  }

    
    const category = await Category.create({
      cat_name,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Failure creating category:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/categories', authenticateToken,async (req, res) => {
  
  try {
    const categories = await Category.findAll();

    res.status(200).json(categories);
  } catch (error) {
    console.error('Failure fetching categories:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/category/:cat_id',authenticateToken, async (req, res) => {
  const cId = req.params.cat_id;

  const validationResult = categoryGetSchema.validate({ cat_id });

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
  }

  try {
    const curCat = await Category.findByPk(cId);

    if (!curCat) {
      return res.status(404).json({message: 'Invalid cat_id' });
    }

    res.status(200).json(curCat);
  } catch (error) {
    console.error(`Error fetching category with cat_id ${cId}:`, error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.delete('/category/:cat_id', authenticateToken,async (req, res) => {
  const cId = req.params.cat_id;

  const validationResult = categoryGetSchema.validate({ cat_id });

    if (validationResult.error) {
      return res.status(400).json({ message: validationResult.error.details[0].message });
  }

  try {
    const deletedCategory = await Category.findByPk(cId);

    if (!deletedCategory) {
      return res.status(404).json({message: 'Invalid cat_id' });
    }

    await deletedCategory.destroy();

    res.status(200).json(deletedCategory);
  } catch (error) {
    console.error(`Failure deleting category with cat_id ${cId}:`, error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.post('/record', authenticateToken,async (req, res) => {
  const { user_id, cat_id, amount } = req.body;

  const validationResult = recordSchema.validate({ user_id, cat_id, amount });

  if (validationResult.error) {
    return res.status(400).json({message: validationResult.error.details[0].message });
  }

  try {
    const user = await User.findByPk(user_id);
    const category = await Category.findByPk(cat_id);

    if (!user || !category) {
      return res.status(400).json({message: 'Invalid input' });
    }

    const record = await Record.create({
      user_id,
      cat_id,
      amount,
    });

    const wallet = await Wallet.findOne({
      where: { user_id },
    });

    if (!wallet) {
      return res.status(400).json({message: 'Wallet not found' });
    }

    wallet.balance -= amount;
    await wallet.save();

    res.status(201).json(record);
  } catch (error) {
    console.error('Failure creating record:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});


router.get('/records',authenticateToken, async (req, res) => {
    
  try {
    const records = await Record.findAll();

    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/record', authenticateToken,async (req, res) => {
  const { user_id, cat_id } = req.query;

  try {

    const whereClause = {};
    if (user_id) { 
      whereClause.user_id = user_id; 
    }
    if (cat_id) { 
      whereClause.cat_id = cat_id; 
    }

    const filteredRecords = await Record.findAll({
      where: whereClause,
    });

    res.status(200).json(filteredRecords);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

  router.delete('/record/:rec_id', authenticateToken,async (req, res) => {
    const rec_id = req.params.rec_id;
  
    try {
      
      const deletedRecord = await Record.findByPk(rec_id);
  
      if (!deletedRecord) {
        return res.status(404).json({message: 'Invalid rec_id' });
      }
  
      await deletedRecord.destroy();
  
      res.status(200).json(deletedRecord);
    } catch (error) {
      console.error(`Error deleting record with rec_id ${rec}:`, error);
      res.status(500).json({message: 'Server Malfunction' });
    }
  });

router.post('/wallet',authenticateToken, async (req, res) => {
  const { user_id } = req.body;

  const validationResult = walletPostSchema.validate({ user_id });

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
    }

  try {
    
    const user = await User.findByPk(user_id);

    if (!user) {
      return res.status(400).json({message: 'User not found' });
    }

    const existingWallet = await Wallet.findOne({
      where: { user_id },
    });

    if (existingWallet) {
      return res.status(400).json({message: 'Wallet already exists for this user' });
    }

    const wallet = await Wallet.create({
      user_id,
      balance: 0,
    });

    res.status(201).json(wallet);
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.post('/raise/:user_id',authenticateToken, async (req, res) => {
  const { user_id } = req.params;
  const { amount } = req.body;

  const validationResult = walletRaiseSchema.validate({ user_id, amount });

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
    }

  try {
    let wallet = await Wallet.findOne({ where: { user_id } });

    if (!wallet) {
      wallet = await Wallet.create({ user_id, balance: 0 });
    }

    wallet.balance += amount;
    await wallet.save();

    res.status(200).json({ user_id, new_balance: wallet.balance });
  } catch (error) {
    console.error(`Error adding amount to balance for user_id ${user_id}:`, error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/wallets', authenticateToken,async (req, res) => {
  
  try {
    const wallets = await Wallet.findAll();

    res.status(200).json(wallets);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/wallet/:user_id', authenticateToken,async (req, res) => {
  const { user_id } = req.params;

  const validationResult = walletGetSchema.validate({ user_id});

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
    }

  try {
    const wallet = await Wallet.findOne({ where: { user_id } });

    if (!wallet) {
      return res.status(404).json({message: 'No wallet found for user_id' });
    }

    res.status(200).json({ user_id, balance: wallet.balance });
  } catch (error) {
    console.error(`Error fetching balance for user_id ${user_id}:`, error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.delete('/wallet/:user_id', authenticateToken,async (req, res) => {
  const { user_id } = req.params;

  const validationResult = walletGetSchema.validate({ user_id});

    if (validationResult.error) {
      return res.status(400).json({message: validationResult.error.details[0].message });
    }

  try {
    const deletedWallet = await Wallet.findOne({ where: { user_id } });

    if (!deletedWallet) {
      return res.status(404).json({message: 'No wallet found for user_id' });
    }

    await deletedWallet.destroy();

    res.status(200).json({ user_id, message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error(`Error deleting wallet for user_id ${user_id}:`, error);
    res.status(500).json({message: 'Server Malfunction' });
  }
});

router.get('/healthcheck', (req, res) => {
 
  const currentDate = new Date();
  const status = 'success';

  
  const response = {
    date: currentDate,
    status: status,
  };

  
  res.status(200).json(response);
});

module.exports = router;
